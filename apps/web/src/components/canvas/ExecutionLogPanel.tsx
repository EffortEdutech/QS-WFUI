'use client';

/**
 * ExecutionLogPanel
 *
 * Displays per-node execution log entries after a workflow run.
 * Shown below the canvas after the Run button is clicked.
 */

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

  return (
    <div className="border-b border-gray-100 last:border-0 py-3 px-4">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{log.nodeName}</span>
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
          {log.status}
        </span>
        {log.durationMs !== undefined && (
          <span className="text-xs text-gray-400 ml-1">{fmt(log.durationMs)}</span>
        )}
      </div>
      <p className="ml-4 mt-0.5 text-[11px] text-gray-400 font-mono">{log.nodeType}</p>

      {/* Error */}
      {log.error && (
        <div className="ml-4 mt-1.5 rounded bg-red-50 border border-red-200 px-2 py-1">
          <p className="text-[11px] text-red-700 font-mono">{log.error.code}: {log.error.message}</p>
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

export default function ExecutionLogPanel({ run, logs, loading, onClose }: Props) {
  const runStatusStyle = run?.status === 'completed'
    ? 'text-green-700 bg-green-50 border-green-200'
    : run?.status === 'failed'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  return (
    <div className="flex flex-col border-t border-gray-200 bg-white" style={{ height: 280 }}>
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

      {/* Run ID */}
      {run?.runId && (
        <div className="px-4 py-1.5 border-t border-gray-100 flex-shrink-0">
          <p className="text-[10px] text-gray-300 font-mono">Run ID: {run.runId}</p>
        </div>
      )}
    </div>
  );
}
