'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import NodePalette from '@/components/canvas/NodePalette';
import type { BulkModeRequest } from '@/components/canvas/WorkflowCanvas';
import type { SkillMode } from '@lados/shared-types';
import ExecutionLogPanel from '@/components/canvas/ExecutionLogPanel';
import VersionHistoryDrawer from '@/components/canvas/VersionHistoryDrawer';
import RunHistoryPanel from '@/components/canvas/RunHistoryPanel';
import FileUploadPanel from '@/components/canvas/FileUploadPanel';
import LibraryPanel from '@/components/canvas/LibraryPanel';
import DataPackBrowser from '@/components/canvas/DataPackBrowser';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import type { QSWorkflowDefinition, WorkflowConnection, WorkflowNodeId } from '@lados/shared-types';

// ── Normalize definition from DB ───────────────────────────────────────────────
// Templates stored via SQL seed may use React Flow's "edges" key instead of
// the canonical "connections" key. Convert to ensure the canvas never crashes.
function normalizeDefinition(raw: unknown): QSWorkflowDefinition {
  const def = raw as QSWorkflowDefinition & {
    version?: string;
    edges?: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
  };

  // Convert seed-style edges [{id, source, target}] → canonical connections
  const connections: WorkflowConnection[] = def.connections?.length
    ? def.connections
    : (def.edges ?? []).map((e) => ({
        id: e.id,
        sourceNodeId: e.source as WorkflowNodeId,
        sourcePortId: e.sourceHandle ?? 'out',
        targetNodeId: e.target as WorkflowNodeId,
        targetPortId: e.targetHandle ?? 'in',
      })) as WorkflowConnection[];

  return {
    ...def,
    // Ensure canonical schemaVersion so auto-save round-trips cleanly
    schemaVersion: def.schemaVersion ?? '1.0',
    // Ensure workflow metadata stub exists (validator no longer requires it,
    // but the canvas spreads it in auto-save so it must not be undefined)
    workflow: def.workflow ?? {
      id: '' as WorkflowNodeId,
      name: '',
      version: '1.0.0',
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    nodes: def.nodes ?? [],
    connections,
  };
}

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
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'documents' | 'datapacks' | 'history'>('nodes');

  // ── Validation state (S18-001) ────────────────────────────────────────────
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  // ── Version history drawer (S18-002) ──────────────────────────────────────
  const [showVersions, setShowVersions] = useState(false);

  // ── Bulk mode request (S14-007) ───────────────────────────────────────────
  const [bulkModeRequest, setBulkModeRequest] = useState<BulkModeRequest | null>(null);

  const handleBulkMode = useCallback((nodeTypes: string[], mode: SkillMode) => {
    setBulkModeRequest({ nodeTypes, mode, stamp: Date.now() });
  }, []);

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
          setDefinition(normalizeDefinition(res.data.definition));
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
      <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
        {/* Breadcrumb */}
        <Link
          href={`/projects/${projectId}`}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          ← Workflows
        </Link>
        <span className="text-gray-200">|</span>
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
          {/* Version history button — S18-002 */}
          <button
            onClick={() => setShowVersions(true)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
            title="Version history"
          >
            🕐 Versions
          </button>

          {/* Export button — S16-004 */}
          <button
            onClick={async () => {
              const res = await apiClient.get<Record<string, unknown>>(
                `/projects/${projectId}/workflows/${workflowId}/export`,
              );
              if (!res.success || !res.data) return;
              const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href     = url;
              a.download = `${workflowName.replace(/\s+/g, '_')}.qsos.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
            title="Export workflow JSON"
          >
            ↓ Export
          </button>

          {/* Run button */}
          <button
            onClick={handleRunClick}
            disabled={running || hasValidationErrors}
            title={hasValidationErrors ? 'Fix connection errors before running' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              running || hasValidationErrors
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
            {([
              { id: 'nodes',     label: '⬡ Skills'    },
              { id: 'datapacks', label: '📦 Data'      },
              { id: 'documents', label: '📂 Files'     },
              { id: 'history',   label: '🕐 History'   },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSidebarTab(id)}
                className={`flex-1 py-2 text-[10px] font-medium transition-colors ${
                  sidebarTab === id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'nodes'     && <NodePalette onBulkMode={handleBulkMode} />}
            {sidebarTab === 'datapacks' && <DataPackBrowser />}
            {sidebarTab === 'documents' && <LibraryPanel organizationId={organizationId} projectId={projectId} />}
            {sidebarTab === 'history'   && (
              <RunHistoryPanel
                workflowId={workflowId}
                reRunning={running}
                onLoadRun={(summary, logs) => {
                  setRunSummary(summary);
                  setRunLogs(logs);
                  setShowLogs(true);
                }}
                onReRun={() => void executeRun()}
              />
            )}
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
              bulkModeRequest={bulkModeRequest}
              onValidationChange={setHasValidationErrors}
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

      {/* Version history drawer — S18-002 */}
      {showVersions && (
        <VersionHistoryDrawer
          projectId={projectId}
          workflowId={workflowId}
          onClose={() => setShowVersions(false)}
          onRestored={() => {
            // Reload the workflow definition after restore
            apiClient
              .get<{ definition: unknown; name: string }>(
                `/projects/${projectId}/workflows/${workflowId}`,
              )
              .then((res) => {
                if (res.success && res.data) {
                  setDefinition(normalizeDefinition(res.data.definition));
                  setWorkflowName(res.data.name);
                }
              });
          }}
        />
      )}
    </div>
  );
}
