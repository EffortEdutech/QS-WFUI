'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import NodePalette from '@/components/canvas/NodePalette';
import ExecutionLogPanel from '@/components/canvas/ExecutionLogPanel';
import FileUploadPanel from '@/components/canvas/FileUploadPanel';
import LibraryPanel from '@/components/canvas/LibraryPanel';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import type { QSWorkflowDefinition } from '@qsos/shared-types';

const WorkflowCanvas = dynamic(() => import('@/components/canvas/WorkflowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Loading canvas…
    </div>
  ),
});

interface PageProps {
  params: { projectId: string; workflowId: string };
}

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

interface NodeLog {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { code: string; message: string };
  messages: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface RunSummary {
  runId: string;
  status: string;
  durationMs: number;
  nodeCount: number;
}

// Node types that need a file input before running
const FILE_NODE_TYPES = new Set([
  'document.upload_file',
  'document.read_excel',
  'qs.read_boq',
]);

function workflowNeedsFile(definition: QSWorkflowDefinition): boolean {
  const nodes = definition.nodes ?? [];
  if (nodes.length === 0) return false;

  // If there are read_excel nodes, only prompt for upload when at least one
  // has no library_file_id — the library takes priority at runtime so nodes
  // that are already wired to the library don't need a runtime upload.
  const readExcelNodes = nodes.filter((n) => n.type === 'document.read_excel');
  if (readExcelNodes.length > 0) {
    return readExcelNodes.some((n) => !n.config?.library_file_id);
  }

  // No read_excel nodes — fall back to type-based check.
  return nodes.some((n) => FILE_NODE_TYPES.has(n.type));
}

export default function WorkflowEditorPage({ params }: PageProps) {
  const { projectId, workflowId } = params;
  const [definition, setDefinition] = useState<QSWorkflowDefinition | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');

  // ── Execution state ────────────────────────────────────────────────────────
  const [running, setRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [runLogs, setRunLogs] = useState<NodeLog[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  // ── Sidebar tab ───────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'documents'>('nodes');

  // ── File upload state ──────────────────────────────────────────────────────
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // ── Load workflow ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Load org context for file upload
    apiClient.get<{ id: string; name: string; membership: { role: string } }[]>('/organizations')
      .then((res) => {
        if (res.data?.[0]) setOrganizationId(res.data[0].id);
      });

    apiClient
      .get<{ definition: QSWorkflowDefinition; name: string }>(
        `/projects/${projectId}/workflows/${workflowId}`,
      )
      .then((res) => {
        if (res.success && res.data) {
          setDefinition(res.data.definition);
          setWorkflowName(res.data.name);
        } else {
          setError(res.error?.message ?? 'Failed to load workflow');
        }
      })
      .catch(() => setError('Network error loading workflow'));
  }, [projectId, workflowId]);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (updated: QSWorkflowDefinition) => {
      setSaveState('saving');
      try {
        const res = await apiClient.put<unknown>(
          `/projects/${projectId}/workflows/${workflowId}/definition`,
          { definition: updated },
        );
        setSaveState(res.success ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [projectId, workflowId],
  );

  // ── Run workflow ───────────────────────────────────────────────────────────

  const handleRunClick = useCallback(() => {
    if (!definition) return;
    // If workflow uses file nodes and no file uploaded yet, show upload panel
    if (workflowNeedsFile(definition) && !uploadedFileId) {
      setShowUploadPanel(true);
      return;
    }
    void executeRun();
  }, [definition, uploadedFileId]);

  const handleFileUploaded = useCallback((fileId: string, fileName: string) => {
    setUploadedFileId(fileId);
    setUploadedFileName(fileName);
    setShowUploadPanel(false);
    // Auto-start run after upload
    setTimeout(() => void executeRun(fileId), 300);
  }, []);

  const handleSkipUpload = useCallback(() => {
    setShowUploadPanel(false);
    void executeRun();
  }, []);

  async function executeRun(fileId?: string) {
    setRunning(true);
    setShowLogs(true);
    setRunSummary(null);
    setRunLogs([]);
    setRunError(null);

    // Build inputs — pass file_id if available
    const inputs: Record<string, unknown> = {};
    const resolvedFileId = fileId ?? uploadedFileId;
    if (resolvedFileId) {
      inputs['file_id'] = resolvedFileId;
    }

    try {
      const res = await apiClient.post<RunSummary>(
        `/workflows/${workflowId}/run`,
        { inputs },
      );

      if (!res.success || !res.data) {
        setRunError(res.error?.message ?? 'Run failed');
        setRunning(false);
        return;
      }

      const summary = res.data;
      setRunSummary(summary);

      const logsRes = await apiClient.get<NodeLog[]>(`/runs/${summary.runId}/logs`);
      setRunLogs(logsRes.data ?? []);
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setRunning(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const saveLabel: Record<SaveState, string> = {
    saved: '✓ Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: '⚠ Save failed',
  };
  const saveLabelColor: Record<SaveState, string> = {
    saved: 'text-green-600',
    saving: 'text-gray-400',
    unsaved: 'text-amber-500',
    error: 'text-red-500',
  };

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
  }
  if (!definition) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
        Loading workflow…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* ── Toolbar ── */}
      <header className="flex h-12 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4">
        <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
          {workflowName}
        </span>
        <span className="text-gray-300">|</span>
        <span className={`text-xs ${saveLabelColor[saveState]}`}>
          {saveLabel[saveState]}
        </span>

        {/* Uploaded file badge */}
        {uploadedFileName && (
          <>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <span>📎</span>
              <span className="truncate max-w-[160px]">{uploadedFileName}</span>
              <button
                onClick={() => { setUploadedFileId(null); setUploadedFileName(null); }}
                className="text-green-400 hover:text-green-600 ml-0.5"
                title="Remove file"
              >
                ✕
              </button>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Run button */}
          <button
            onClick={handleRunClick}
            disabled={running}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              running
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {running ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-green-400 animate-spin" />
                Running…
              </>
            ) : (
              <>▶ Run</>
            )}
          </button>

          {!showLogs && runSummary && (
            <button
              onClick={() => setShowLogs(true)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              View logs
            </button>
          )}
        </div>
      </header>

      {/* ── Canvas area ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Left sidebar with tab switcher ── */}
        <div className="flex flex-col w-56 flex-shrink-0 border-r border-gray-200 bg-white">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            {(['nodes', 'documents'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  sidebarTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'nodes' ? '⬡ Nodes' : '📂 Documents'}
              </button>
            ))}
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'nodes'
              ? <NodePalette />
              : <LibraryPanel organizationId={organizationId} projectId={projectId} />
            }
          </div>
        </div>
        <main className="relative flex-1 overflow-hidden flex flex-col">
          {/* Canvas */}
          <div className="flex-1 overflow-hidden">
            <WorkflowCanvas
              definition={definition}
              onSave={handleSave}
              organizationId={organizationId}
              projectId={projectId}
            />
          </div>

          {/* File upload overlay */}
          {showUploadPanel && organizationId && (
            <FileUploadPanel
              organizationId={organizationId}
              projectId={projectId}
              workflowId={workflowId}
              onUploaded={handleFileUploaded}
              onSkip={handleSkipUpload}
            />
          )}

          {/* Run error banner */}
          {runError && !showLogs && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex items-center gap-2">
              <span>⚠ {runError}</span>
              <button onClick={() => setRunError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Execution log panel */}
          {showLogs && (
            <ExecutionLogPanel
              run={runSummary}
              logs={runLogs}
              loading={running}
              onClose={() => setShowLogs(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
