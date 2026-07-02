'use client';

/**
 * ExecutionLogPanel â€” Skill Execution Log (V3)
 * Sprint 17: ArtifactSection now includes "Distribute to Suppliers" button
 *
 * Displays per-skill execution log entries after a workflow run.
 * Sprint 6:  basic log rows
 * Sprint 9:  artifact download section for procurement.generate_rfq outputs
 * Sprint 13: V3 â€” business-friendly skill names, pack chips, mode badges,
 *             "skill" language throughout (was "node")
 * Sprint 16: expandable output inspector per node row (S16-003)
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { useExecutionStore } from '@/stores';

interface RfqArtifact {
  trade: string;
  label: string;
  url: string;
  size_bytes: number;
  package_value: number;
  currency: string;
  item_count: number;
  storage_path?: string;
}

interface NodeLog {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { code: string; message: string };
  messages?: string[];
  dataPackUsages?: DataPackUsage[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface DataPackUsage {
  itemId: string;
  itemKey: string;
  title: string;
  unit: string | null;
  packSlug: string;
  packName: string;
  version: string;
  collectionKey: string;
  collectionName: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceDate: string | null;
  region: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  classification: string | null;
  advisoryStatus: string;
  applicabilityNotes: string | null;
  assumptions: string | null;
}

interface RunSummary {
  runId: string;
  status: string;
  durationMs: number;
  nodeCount: number;
}

interface Props {
  run?: RunSummary | null;
  logs?: NodeLog[];
  loading?: boolean;
  onClose: () => void;
}

// â”€â”€ Pack label map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Derives a human-readable pack name from the nodeType prefix.
// e.g. "qs.classify_trade" â†’ prefix "qs" â†’ "QS Pack"
const PACK_LABELS: Record<string, string> = {
  'qs':          'QS Pack',
  'document':    'Document Pack',
  'procurement': 'Procurement Pack',
  'core':        'Core',
  'project':     'Project Pack',
  'workflow':    'Workflow',
};
const PACK_COLORS: Record<string, string> = {
  'qs':          'bg-blue-50 text-blue-600',
  'document':    'bg-purple-50 text-purple-600',
  'procurement': 'bg-orange-50 text-orange-600',
  'core':        'bg-gray-100 text-gray-500',
  'project':     'bg-green-50 text-green-600',
  'workflow':    'bg-teal-50 text-teal-600',
};

function getPackLabel(nodeType: string): string {
  const prefix = nodeType.split('.')[0] ?? '';
  return PACK_LABELS[prefix] ?? prefix;
}
function getPackColor(nodeType: string): string {
  const prefix = nodeType.split('.')[0] ?? '';
  return PACK_COLORS[prefix] ?? 'bg-gray-100 text-gray-500';
}

// â”€â”€ Error hints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** S10-004: User-friendly error code descriptions */
const ERROR_HINTS: Record<string, string> = {
  NO_BOQ:             'No BOQ data received. Connect a Read BOQ node above this node.',
  NO_ITEMS:           'BOQ has no items. Verify the Excel file contains data rows.',
  FILE_NOT_FOUND:     'BOQ file not found. Upload the file via the Library panel first.',
  NO_FILE_ID:         'No file selected. Open the node properties and choose a BOQ file.',
  PARSE_ERROR:        'Could not read the Excel file. Ensure it is a valid .xlsx file.',
  AI_UNAVAILABLE:     'AI service not reachable. Using keyword classification as fallback.',
  ALL_PACKAGES_FAILED:'All RFQ documents failed to generate. Check Supabase Storage bucket permissions.',
  CYCLE_DETECTED:     'Workflow has a circular dependency. Remove the looping connection.',
  RUNNER_EXCEPTION:   'An unexpected error stopped the run. Check the API logs.',
  UNHANDLED_EXCEPTION:'A node threw an unexpected error. See the message below for details.',
};

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  completed: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  failed:    { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700' },
  running:   { dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-100 text-blue-700' },
  paused:    { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  skipped:   { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500' },
  pending:   { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500' },
  waiting:   { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
};

function fmt(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function OutputInspector({ outputs }: { outputs: Record<string, unknown> }) {
  // Render outputs in a friendly way: string values inline, objects/arrays as JSON
  const entries = Object.entries(outputs);
  if (entries.length === 0) return <p className="text-[10px] text-gray-400 italic">No outputs</p>;
  return (
    <div className="space-y-1">
      {entries.map(([key, val]) => {
        const isComplex = typeof val === 'object' && val !== null;
        return (
          <div key={key}>
            <span className="text-[10px] font-mono font-semibold text-gray-500">{key}: </span>
            {isComplex ? (
              <pre className="mt-0.5 text-[9px] font-mono text-gray-600 bg-gray-100 rounded px-2 py-1 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                {JSON.stringify(val, null, 2)}
              </pre>
            ) : (
              <span className="text-[10px] font-mono text-gray-700">
                {val === null ? 'null' : String(val)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DataPackUsageBlock({ usages }: { usages: DataPackUsage[] }) {
  if (usages.length === 0) return null;

  return (
    <div className="ml-4 mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        Data Pack Provenance
      </p>
      <div className="mt-1.5 space-y-1.5">
        {usages.map((usage) => (
          <div key={`${usage.packSlug}:${usage.version}:${usage.itemId}`} className="rounded bg-white/70 px-2 py-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-amber-950" title={usage.title}>
                  {usage.title}
                </p>
                <p className="mt-0.5 truncate font-mono text-[9px] text-amber-700">
                  {usage.packSlug} / v{usage.version} / {usage.collectionKey} / {usage.itemKey}
                </p>
              </div>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                {usage.classification ?? usage.advisoryStatus}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-amber-800">
              Source: <span className="font-semibold">{usage.sourceName}</span>
              {usage.sourceDate ? ` · ${usage.sourceDate}` : ''}
              {usage.region ? ` · ${usage.region}` : ''}
              {usage.unit ? ` · ${usage.unit}` : ''}
            </p>
            {usage.assumptions && (
              <p className="mt-1 text-[9px] leading-snug text-amber-700">
                {usage.assumptions}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-snug text-amber-700">
        Reference/advisory data only. Human review remains required for QS/commercial decisions.
      </p>
    </div>
  );
}

function NodeLogRow({ log }: { log: NodeLog }) {
  const [expanded, setExpanded] = useState(false);

  const styles = STATUS_STYLES[log.status] ?? STATUS_STYLES['pending'];
  // DB rows arrive snake_case; TS interface is camelCase â€” read both
  const raw = (log as unknown) as Record<string, unknown>;
  const nodeName   = log.nodeName   ?? raw['node_name']   as string ?? '-';
  const nodeType   = log.nodeType   ?? raw['node_type']   as string ?? '';
  const durationMs = log.durationMs ?? raw['duration_ms'] as number | undefined;
  const outputs    = log.outputs    ?? raw['outputs']     as Record<string, unknown> | undefined;
  const dataPackUsages = (log.dataPackUsages ?? raw['data_pack_usages'] ?? []) as DataPackUsage[];
  // V3: mode from log entry (execution engine may set this in Sprint 14+)
  const mode       = raw['mode'] as string | undefined;

  const packLabel = getPackLabel(nodeType);
  const packColor = getPackColor(nodeType);
  const hasOutputs = outputs && Object.keys(outputs).length > 0;

  return (
    <div className="border-b border-gray-100 last:border-0 py-2.5 px-4">
      {/* Row 1: status dot + skill name + status badge + duration + expand toggle */}
      <div
        className={`flex items-center gap-2 ${hasOutputs ? 'cursor-pointer' : ''}`}
        onClick={() => hasOutputs && setExpanded((v) => !v)}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{nodeName}</span>
        {/* Mode badge â€” only when not active */}
        {mode && mode !== 'active' && (
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
            mode === 'muted' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-600'
          }`}>
            {mode}
          </span>
        )}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
          {log.status}
        </span>
        {durationMs !== undefined && (
          <span className="text-[10px] text-gray-400">{fmt(durationMs)}</span>
        )}
        {hasOutputs && (
          <span className="text-[10px] text-gray-300 flex-shrink-0">
            {expanded ? 'Hide' : 'Show'}
          </span>
        )}
      </div>

      {/* Row 2: pack chip + nodeType (secondary) */}
      <div className="ml-4 mt-0.5 flex items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${packColor}`}>
          {packLabel}
        </span>
        <span className="text-[10px] text-gray-300 font-mono">{nodeType}</span>
        {hasOutputs && !expanded && (
          <span className="text-[10px] text-blue-400 ml-auto cursor-pointer hover:text-blue-600"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
            Inspect outputs
          </span>
        )}
      </div>

      {/* Error */}
      {log.error && (
        <div className="ml-4 mt-1.5 rounded bg-red-50 border border-red-200 px-2 py-1.5 space-y-0.5">
          <p className="text-[11px] text-red-700 font-mono font-semibold">{log.error.code}</p>
          <p className="text-[11px] text-red-600">{log.error.message}</p>
          {ERROR_HINTS[log.error.code] && (
            <p className="text-[11px] text-red-500 italic">{ERROR_HINTS[log.error.code]}</p>
          )}
        </div>
      )}

      {/* Log messages */}
      {(log.messages?.length ?? 0) > 0 && (
        <div className="ml-4 mt-1.5 space-y-0.5">
          {(log.messages ?? []).map((msg, i) => (
            <p key={i} className="text-[11px] text-gray-500 font-mono leading-tight">{msg}</p>
          ))}
        </div>
      )}

      <DataPackUsageBlock usages={dataPackUsages} />

      {/* Output Inspector â€” S16-003 */}
      {expanded && hasOutputs && (
        <div className="ml-4 mt-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Outputs
          </p>
          <OutputInspector outputs={outputs!} />
        </div>
      )}
    </div>
  );
}

/** Extract RFQ artifacts from the procurement.generate_rfq node logs.
 *  Handles both camelCase (NodeLog interface) and snake_case (raw DB rows). */
function extractArtifacts(logs: NodeLog[]): RfqArtifact[] {
  for (const log of logs) {
    // DB returns snake_case; TS interface uses camelCase â€” handle both
    const nodeType = log.nodeType ?? ((log as unknown) as Record<string, unknown>)['node_type'] as string;
    const outputs  = log.outputs  ?? ((log as unknown) as Record<string, unknown>)['outputs']   as Record<string, unknown>;
    if (nodeType === 'procurement.generate_rfq' && log.status === 'completed') {
      const docs = outputs?.['documents'];
      if (Array.isArray(docs) && docs.length > 0) {
        return docs as RfqArtifact[];
      }
    }
  }
  return [];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// â”€â”€ RFQ Distribute Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SupplierOption { id: string; name: string; trades: string[]; email: string | null; }

function DistributeModal({
  artifacts,
  runId,
  onClose,
}: {
  artifacts: RfqArtifact[];
  runId: string | undefined;
  onClose: () => void;
}) {
  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([]);
  const [orgId, setOrgId]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  // Map: trade â†’ Set of selected supplier IDs
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [distributing, setDistributing] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Load org + suppliers
  useEffect(() => {
    async function load() {
      try {
        const { apiClient } = await import('@/lib/api/client');
        const orgRes = await apiClient.get<{ id: string }[]>('/organizations');
        const org = orgRes.data?.[0];
        if (!org) return;
        setOrgId(org.id);
        const supRes = await apiClient.get<SupplierOption[]>(
          `/organizations/${org.id}/suppliers?status=active`,
        );
        setSuppliers(supRes.data ?? []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function toggle(trade: string, supplierId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(prev[trade] ?? []);
      set.has(supplierId) ? set.delete(supplierId) : set.add(supplierId);
      next[trade] = set;
      return next;
    });
  }

  async function handleDistribute() {
    if (!orgId) return;
    const { apiClient } = await import('@/lib/api/client');
    setDistributing(true);
    setError(null);
    try {
      const items: { supplier_id: string; trade: string; storage_path: string; run_id?: string }[] = [];
      for (const artifact of artifacts) {
        const chosen = selections[artifact.trade] ?? new Set();
        for (const supplierId of chosen) {
          items.push({
            supplier_id:  supplierId,
            trade:        artifact.trade,
            storage_path: artifact.storage_path ?? '',
            run_id:       runId,
          });
        }
      }
      if (items.length === 0) { setError('Select at least one supplier per trade.'); return; }
      await apiClient.post(`/organizations/${orgId}/rfq-distributions`, { items });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  }

  const totalSelected = Object.values(selections).reduce((s, set) => s + set.size, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Distribute RFQs to Suppliers</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">Close</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <p className="text-sm font-semibold text-gray-800">
                {totalSelected} distribution record{totalSelected !== 1 ? 's' : ''} created
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Track delivery status in the Suppliers page. Links expire in 2 hours.
              </p>
            </div>
          ) : loading ? (
            <p className="text-sm text-gray-400 text-center py-8 animate-pulse">Loading suppliers...</p>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No active suppliers found.</p>
              <p className="text-xs text-gray-400 mt-1">Add suppliers in the Suppliers page first.</p>
            </div>
          ) : (
            artifacts.map((artifact) => {
              const matching = suppliers.filter(
                (s) => s.trades.includes(artifact.trade) || s.trades.length === 0,
              );
              const sel = selections[artifact.trade] ?? new Set<string>();
              return (
                <div key={artifact.trade} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-blue-50 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800">{artifact.label}</span>
                    <span className="text-[10px] text-blue-500">{sel.size} selected</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {matching.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400 italic">
                        No suppliers registered for {artifact.trade} trade.
                      </p>
                    ) : (
                      matching.map((s) => (
                        <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sel.has(s.id)}
                            onChange={() => toggle(artifact.trade, s.id)}
                            className="rounded"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-800 block truncate">{s.name}</span>
                            {s.email && <span className="text-[10px] text-gray-400">{s.email}</span>}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {!done && (
          <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDistribute}
              disabled={distributing || suppliers.length === 0}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {distributing ? 'Saving...' : `Distribute (${totalSelected})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactSection({ artifacts, runId }: { artifacts: RfqArtifact[]; runId?: string }) {
  const [showDistribute, setShowDistribute] = useState(false);
  if (artifacts.length === 0) return null;
  return (
    <>
      <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
            RFQ Documents Ready - {artifacts.length} file{artifacts.length > 1 ? 's' : ''} generated
          </p>
          <button
            onClick={() => setShowDistribute(true)}
            className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Distribute
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {artifacts.map((a) => (
            <a
              key={a.trade}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-1.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors group"
            >
              <span className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold text-blue-800 group-hover:text-blue-900 truncate max-w-[140px]">
                  {a.label}
                </span>
                <span className="text-[10px] text-blue-400">
                  {a.item_count} items - {formatBytes(a.size_bytes)}
                </span>
              </span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-blue-400 italic">
          Links expire in 2 hours - AI-assisted, for human review only
        </p>
      </div>
      {showDistribute && (
        <DistributeModal
          artifacts={artifacts}
          runId={runId}
          onClose={() => setShowDistribute(false)}
        />
      )}
    </>
  );
}

// â”€â”€ Paused: inline approve / reject banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PendingTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

function PausedApprovalBanner({ runId, onDecided }: { runId: string; onDecided: () => void }) {
  const [tasks, setTasks]       = useState<PendingTask[]>([]);
  const [comments, setComments] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await apiClient.get<PendingTask[]>(`/approvals/run/${runId}`);
    if (!res.error) setTasks((res.data ?? []).filter((t) => t.status === 'pending'));
  }, [runId]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  async function decide(taskId: string, decision: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    const res = await apiClient.post<unknown>(`/approvals/${taskId}/decide`, { decision, comments });
    if (res.error) {
      setError(typeof res.error === 'string' ? res.error : 'Decision failed');
    } else {
      onDecided();
    }
    setBusy(false);
  }

  if (tasks.length === 0) return null;

  const task = tasks[0];  // Show the first pending task

  return (
    <div className="mx-4 my-3 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">Awaiting human approval</p>
          <p className="text-xs text-amber-700 mt-0.5">{task.title}</p>
          {task.description && (
            <p className="text-xs text-amber-600 mt-0.5">{task.description}</p>
          )}
        </div>
      </div>

      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Optional comments..."
        rows={2}
        maxLength={1000}
        className="w-full text-xs border border-amber-200 bg-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void decide(task.id, 'approved')}
          disabled={busy}
          className="flex-1 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? '...' : 'Approve'}
        </button>
        <button
          onClick={() => void decide(task.id, 'rejected')}
          disabled={busy}
          className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? '...' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Main panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ExecutionLogPanel({ run, logs, loading, onClose }: Props) {
  const storeRun = useExecutionStore((state) => state.runSummary);
  const storeLogs = useExecutionStore((state) => state.nodeLogList);
  const storeLoading = useExecutionStore((state) => state.polling);
  const activeRun = run ?? storeRun;
  const activeLogs = logs ?? storeLogs;
  const activeLoading = loading ?? storeLoading;

  const runStatusStyle = activeRun?.status === 'completed'
    ? 'text-green-700 bg-green-50 border-green-200'
    : activeRun?.status === 'failed'
    ? 'text-red-700 bg-red-50 border-red-200'
    : activeRun?.status === 'paused'
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  const artifacts = extractArtifacts(activeLogs);

  return (
    <div className="flex flex-col border-t border-gray-200 bg-white" style={{ height: artifacts.length > 0 ? 340 : 280 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Skill Execution Log
        </span>

        {activeRun && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${runStatusStyle}`}>
            {activeRun.status} - {fmt(activeRun.durationMs)} - {activeRun.nodeCount} skill{activeRun.nodeCount !== 1 ? 's' : ''}
          </span>
        )}

        {activeLoading && (
          <span className="text-xs text-blue-500 animate-pulse">Running...</span>
        )}

        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 text-xs"
        >
          Close
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto">
        {activeLoading && activeLogs.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">Starting execution...</div>
        )}

        {!activeLoading && activeLogs.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">No logs available.</div>
        )}

        {activeLogs.map((log, i) => (
          <NodeLogRow key={log.nodeId ?? String(i)} log={log} />
        ))}
      </div>

      {/* Phase 1: inline approve / reject when run is paused */}
      {activeRun?.status === 'paused' && activeRun.runId && (
        <PausedApprovalBanner
          runId={activeRun.runId}
          onDecided={onClose}
        />
      )}

      {/* Artifact downloads + distribute (Sprint 9 / Sprint 17) */}
      <ArtifactSection artifacts={artifacts} runId={activeRun?.runId} />

      {/* Run ID */}
      {activeRun?.runId && (
        <div className="px-4 py-1.5 border-t border-gray-100 flex-shrink-0">
          <p className="text-[10px] text-gray-300 font-mono">{activeRun.runId}</p>
        </div>
      )}
    </div>
  );
}

