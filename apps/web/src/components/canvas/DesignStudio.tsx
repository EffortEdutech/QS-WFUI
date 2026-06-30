'use client';

/**
 * DesignStudio — Phase 4B — AI Workflow Design Studio
 *
 * A slide-in drawer that lets users describe a workflow in natural language
 * and have gpt-4o-mini generate a draft node graph from their installed packs.
 *
 * Flow:
 *   1. User types a description ("Extract BOQ from PDF, validate items, notify team")
 *   2. POST /projects/:projectId/workflows/generate → WorkflowSuggestion
 *   3. Preview shows suggested node names and connections
 *   4. "Load to Canvas" button fires onApply() with the draft definition
 *   5. WorkflowCanvas renders the draft + shows AI advisory banner
 *
 * GUARDRAIL (non-negotiable): AI cannot publish. Draft must be reviewed by
 * a human before any publish action. This component never calls /publish.
 */

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { QSWorkflowDefinition, WorkflowNodeInstance, SkillMode } from '@lados/shared-types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SuggestedNode {
  id:       string;
  type:     string;
  label:    string;
  position: { x: number; y: number };
}

interface WorkflowConnection {
  id:           string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

interface WorkflowSuggestion {
  name:           string;
  description:    string;
  suggestedNodes: SuggestedNode[];
  availableNodes: SuggestedNode[];
  connections:    WorkflowConnection[];
}

export interface DesignStudioProps {
  projectId:      string;
  organizationId?: string;
  /** Current workflow definition — used as base when applying the draft */
  baseDefinition: QSWorkflowDefinition;
  isOpen:         boolean;
  onClose:        () => void;
  /** Called when user clicks "Load to Canvas" — passes a ready-to-use draft definition */
  onApply:        (draft: QSWorkflowDefinition) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function connectionLabel(
  conn: WorkflowConnection,
  nodes: SuggestedNode[],
): string {
  const src = nodes.find((n) => n.id === conn.sourceNodeId)?.label ?? conn.sourceNodeId.slice(0, 8);
  const tgt = nodes.find((n) => n.id === conn.targetNodeId)?.label ?? conn.targetNodeId.slice(0, 8);
  return `${src} → ${tgt}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DesignStudio({
  projectId,
  baseDefinition,
  isOpen,
  onClose,
  onApply,
}: DesignStudioProps) {
  const [description, setDescription] = useState('');
  const [generating, setGenerating]   = useState(false);
  const [suggestion, setSuggestion]   = useState<WorkflowSuggestion | null>(null);
  const [error, setError]             = useState<string | null>(null);

  if (!isOpen) return null;

  // ── Generate ────────────────────────────────────────────────────────────────

  async function handleGenerate(): Promise<void> {
    if (!description.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setSuggestion(null);

    try {
      const res = await apiClient.post<WorkflowSuggestion>(
        `/projects/${projectId}/workflows/generate`,
        { description: description.trim() },
      );

      if (res.success && res.data) {
        setSuggestion(res.data);
      } else {
        setError(res.error?.message ?? 'AI generation failed — please try again');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }

  // ── Apply draft to canvas ───────────────────────────────────────────────────

  function handleApply(): void {
    if (!suggestion) return;

    const draftNodes: WorkflowNodeInstance[] = suggestion.suggestedNodes.map((n) => ({
      id:       n.id       as WorkflowNodeInstance['id'],
      type:     n.type     as WorkflowNodeInstance['type'],
      label:    n.label,
      position: n.position,
      config:   {},
      mode:     'active' as SkillMode,
    }));

    const draft: QSWorkflowDefinition = {
      ...baseDefinition,
      workflow: {
        ...baseDefinition.workflow,
        name:      suggestion.name || baseDefinition.workflow?.name,
        updatedAt: new Date().toISOString(),
      },
      nodes:       draftNodes,
      connections: suggestion.connections as QSWorkflowDefinition['connections'],
    };

    onApply(draft);
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 z-40 flex w-[420px] flex-col bg-white shadow-2xl border-l border-gray-200">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
          <span className="text-xl">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">AI Design Studio</p>
            <p className="text-[10px] text-gray-400 leading-tight">Describe your workflow — AI generates a draft from your installed packs</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Description input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Describe your workflow
              <span className="ml-1 font-normal text-gray-400">(EN or BM)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Extract BOQ from uploaded PDF, validate all line items, flag anomalies with AI, then notify the QS team"
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-200 resize-none"
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Ctrl+Enter to generate · {description.length}/2000
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              ⚠ {error}
            </div>
          )}

          {/* Suggestion preview */}
          {suggestion && !generating && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 space-y-3">
              {/* Workflow name */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-purple-500 mb-0.5">
                  Generated Workflow
                </p>
                <p className="text-sm font-semibold text-gray-900">{suggestion.name}</p>
                {suggestion.description && (
                  <p className="mt-0.5 text-[11px] text-gray-500">{suggestion.description}</p>
                )}
              </div>

              {/* Node list */}
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  {suggestion.suggestedNodes.length} Node{suggestion.suggestedNodes.length !== 1 ? 's' : ''}
                </p>
                <ol className="space-y-1">
                  {suggestion.suggestedNodes.map((node, i) => (
                    <li key={node.id} className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-4 w-4 rounded-full bg-purple-200 text-purple-700 text-[9px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{node.label}</p>
                        <p className="text-[9px] font-mono text-gray-400 truncate">{node.type}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Connections */}
              {suggestion.connections.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    {suggestion.connections.length} Connection{suggestion.connections.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="space-y-0.5">
                    {suggestion.connections.map((conn) => (
                      <li key={conn.id} className="text-[10px] text-gray-500 truncate">
                        {connectionLabel(conn, suggestion.suggestedNodes)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Guardrail notice */}
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700">
                ⚠ AI draft only — review all nodes and configure required fields before publishing
              </div>
            </div>
          )}

          {/* Loading state */}
          {generating && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-4 border-purple-100 border-t-purple-500 animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-lg">✨</span>
              </div>
              <p className="text-sm text-gray-600 font-medium">Designing your workflow…</p>
              <p className="text-xs text-gray-400">Matching nodes from your installed packs</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 flex items-center gap-2 bg-white">
          <button
            onClick={() => void handleGenerate()}
            disabled={!description.trim() || generating}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-4 text-sm font-semibold transition-colors
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800"
          >
            {generating ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-purple-300 border-t-white animate-spin" />
                Generating…
              </>
            ) : (
              <>✨ {suggestion ? 'Regenerate' : 'Generate'}</>
            )}
          </button>

          {suggestion && !generating && (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-lg py-2 px-4 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors"
            >
              Load to Canvas →
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
