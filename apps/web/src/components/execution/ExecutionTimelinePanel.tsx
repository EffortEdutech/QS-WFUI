'use client';

/**
 * ExecutionTimelinePanel — Phase 11
 *
 * Standalone component (not canvas-embedded) that renders a vertical
 * timeline of node execution steps for a given run.
 *
 * Fetches: GET /execution/runs/:runId/logs
 *
 * Shows per-node: status badge, node name, pack type, duration,
 * and an expandable output / error inspector.
 *
 * Usage:
 *   <ExecutionTimelinePanel runId="abc-123" />
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodeLogEntry {
  nodeId:       string;
  nodeType:     string;
  nodeName:     string;
  status:       'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';
  inputs?:      Record<string, unknown>;
  outputs?:     Record<string, unknown>;
  error?:       { code: string; message: string };
  messages:     string[];
  startedAt?:   string;
  completedAt?: string;
  durationMs?:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  completed: { dot: 'bg-green-500',  label: 'Completed', text: 'text-green-700' },
  running:   { dot: 'bg-blue-500 animate-pulse', label: 'Running', text: 'text-blue-700' },
  failed:    { dot: 'bg-red-500',    label: 'Failed',    text: 'text-red-700'   },
  skipped:   { dot: 'bg-gray-400',   label: 'Skipped',   text: 'text-gray-500'  },
  waiting:   { dot: 'bg-yellow-400', label: 'Waiting',   text: 'text-yellow-700' },
  pending:   { dot: 'bg-gray-300',   label: 'Pending',   text: 'text-gray-500'  },
};

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function packLabel(nodeType: string): string {
  const prefix = nodeType.split('.')[0] ?? '';
  const MAP: Record<string, string> = {
    qs:           'QS Pack',
    core:         'Core',
    notification: 'Notifications',
    construction: 'Construction',
    finance:      'Finance',
    procurement:  'Procurement',
    document:     'Document',
    ai:           'AI',
  };
  return MAP[prefix] ?? prefix;
}

// ── OutputInspector ───────────────────────────────────────────────────────────

function OutputInspector({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    return null;
  }
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── TimelineRow ───────────────────────────────────────────────────────────────

function TimelineRow({
  entry,
  isLast,
}: {
  entry:  NodeLogEntry;
  isLast: boolean;
}) {
  const s = STATUS_STYLES[entry.status] ?? STATUS_STYLES['pending'];

  return (
    <div className="flex gap-3">
      {/* Left gutter: dot + connector line */}
      <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
        <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
        {!isLast && <span className="w-px flex-1 bg-gray-200 my-1" />}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 truncate">
            {entry.nodeName || entry.nodeId}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {packLabel(entry.nodeType)}
          </span>
          <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
          <span className="text-xs text-gray-400 ml-auto">
            {formatDuration(entry.durationMs)}
          </span>
        </div>

        <p className="text-xs text-gray-400 mt-0.5">{entry.nodeType}</p>

        {/* Error */}
        {entry.error && (
          <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            <span className="font-medium">{entry.error.code}: </span>
            {entry.error.message}
          </div>
        )}

        {/* Messages */}
        {entry.messages?.length > 0 && (
          <ul className="mt-1 text-xs text-gray-500 list-disc list-inside space-y-0.5">
            {entry.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        <OutputInspector label="Outputs" data={entry.outputs} />
        <OutputInspector label="Inputs"  data={entry.inputs}  />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  runId:      string;
  className?: string;
}

export function ExecutionTimelinePanel({ runId, className = '' }: Props) {
  const [logs,    setLogs]    = useState<NodeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // API returns { success: true, data: NodeLogEntry[] }
      const res = (await apiClient.get<NodeLogEntry[]>(
        `/runs/${runId}/logs`,
      )) as unknown as { data: NodeLogEntry[] };
      setLogs(res?.data ?? []);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load execution logs');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 text-sm text-gray-500 ${className}`}>
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 ${className}`}>
        {error}
        <button onClick={() => void fetchLogs()} className="ml-2 underline text-red-700">
          Retry
        </button>
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className={`text-center p-8 text-sm text-gray-400 ${className}`}>
        No execution steps recorded for this run.
      </div>
    );
  }

  const completed  = logs.filter((l) => l.status === 'completed').length;
  const failed     = logs.filter((l) => l.status === 'failed').length;
  const totalMs    = logs.reduce((acc, l) => acc + (l.durationMs ?? 0), 0);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Execution Timeline</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{logs.length} steps</span>
          {failed > 0 && (
            <span className="text-red-600 font-medium">{failed} failed</span>
          )}
          <span>{completed}/{logs.length} done</span>
          <span>Total: {formatDuration(totalMs)}</span>
          <button
            onClick={() => void fetchLogs()}
            className="text-gray-400 hover:text-gray-600 text-xs underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        {logs.map((entry, idx) => (
          <TimelineRow
            key={entry.nodeId}
            entry={entry}
            isLast={idx === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
