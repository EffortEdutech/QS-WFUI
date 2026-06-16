'use client';

/**
 * ExecutionLogPanel
 *
 * Displays per-node execution log entries after a workflow run.
 * Sprint 6: basic log rows
 * Sprint 9: artifact download section for procurement.generate_rfq outputs
 */

interface RfqArtifact {
  trade: string;
  label: string;
  url: string;
  size_bytes: number;
  package_value: number;
  currency: string;
  item_count: number;
}

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

interface Props {
  run: RunSummary | null;
  logs: NodeLog[];
  loading: boolean;
  onClose: () => void;
}

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
  skipped:   { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500' },
  pending:   { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500' },
  waiting:   { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
};

function fmt(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function NodeLogRow({ log }: { log: NodeLog }) {
  const styles = STATUS_STYLES[log.status] ?? STATUS_STYLES['pending'];
  // DB rows arrive snake_case; TS interface is camelCase — read both
  const raw = log as Record<string, unknown>;
  const nodeName   = log.nodeName   ?? raw['node_name']   as string ?? '—';
  const nodeType   = log.nodeType   ?? raw['node_type']   as string ?? '';
  const durationMs = log.durationMs ?? raw['duration_ms'] as number | undefined;

  return (
    <div className="border-b border-gray-100 last:border-0 py-3 px-4">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{nodeName}</span>
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
          {log.status}
        </span>
        {durationMs !== undefined && (
          <span className="text-xs text-gray-400 ml-1">{fmt(durationMs)}</span>
        )}
      </div>
      <p className="ml-4 mt-0.5 text-[11px] text-gray-400 font-mono">{nodeType}</p>

      {/* Error */}
      {log.error && (
        <div className="ml-4 mt-1.5 rounded bg-red-50 border border-red-200 px-2 py-1.5 space-y-0.5">
          <p className="text-[11px] text-red-700 font-mono font-semibold">{log.error.code}</p>
          <p className="text-[11px] text-red-600">{log.error.message}</p>
          {ERROR_HINTS[log.error.code] && (
            <p className="text-[11px] text-red-500 italic">💡 {ERROR_HINTS[log.error.code]}</p>
          )}
        </div>
      )}

      {/* Log messages */}
      {log.messages?.length > 0 && (
        <div className="ml-4 mt-1.5 space-y-0.5">
          {log.messages.map((msg, i) => (
            <p key={i} className="text-[11px] text-gray-500 font-mono leading-tight">{msg}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extract RFQ artifacts from the procurement.generate_rfq node logs.
 *  Handles both camelCase (NodeLog interface) and snake_case (raw DB rows). */
function extractArtifacts(logs: NodeLog[]): RfqArtifact[] {
  for (const log of logs) {
    // DB returns snake_case; TS interface uses camelCase — handle both
    const nodeType = log.nodeType ?? (log as Record<string, unknown>)['node_type'] as string;
    const outputs  = log.outputs  ?? (log as Record<string, unknown>)['outputs']   as Record<string, unknown>;
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

function ArtifactSection({ artifacts }: { artifacts: RfqArtifact[] }) {
  if (artifacts.length === 0) return null;
  return (
    <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 flex-shrink-0">
      <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide mb-2">
        📄 RFQ Documents Ready — {artifacts.length} file{artifacts.length > 1 ? 's' : ''} generated
      </p>
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
            <span className="text-blue-500 text-base">⬇</span>
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-blue-800 group-hover:text-blue-900 truncate max-w-[140px]">
                {a.label}
              </span>
              <span className="text-[10px] text-blue-400">
                {a.item_count} items · {formatBytes(a.size_bytes)}
              </span>
            </span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-blue-400 italic">
        Links expire in 2 hours · AI-assisted, for human review only
      </p>
    </div>
  );
}

export default function ExecutionLogPanel({ run, logs, loading, onClose }: Props) {
  const runStatusStyle = run?.status === 'completed'
    ? 'text-green-700 bg-green-50 border-green-200'
    : run?.status === 'failed'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  const artifacts = extractArtifacts(logs);

  return (
    <div className="flex flex-col border-t border-gray-200 bg-white" style={{ height: artifacts.length > 0 ? 340 : 280 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Execution Log
        </span>

        {run && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${runStatusStyle}`}>
            {run.status} · {fmt(run.durationMs)} · {run.nodeCount} node{run.nodeCount !== 1 ? 's' : ''}
          </span>
        )}

        {loading && (
          <span className="text-xs text-blue-500 animate-pulse">Running…</span>
        )}

        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 text-xs"
        >
          ✕ Close
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">Starting execution…</div>
        )}

        {!loading && logs.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">No logs available.</div>
        )}

        {logs.map((log, i) => (
          <NodeLogRow key={log.nodeId ?? String(i)} log={log} />
        ))}
      </div>

      {/* Artifact downloads (Sprint 9 — procurement.generate_rfq) */}
      <ArtifactSection artifacts={artifacts} />

      {/* Run ID */}
      {run?.runId && (
        <div className="px-4 py-1.5 border-t border-gray-100 flex-shrink-0">
          <p className="text-[10px] text-gray-300 font-mono">Run ID: {run.runId}</p>
        </div>
      )}
    </div>
  );
}
