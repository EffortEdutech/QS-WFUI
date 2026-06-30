'use client';

/**
 * AIOutputLedgerPanel — Phase 11
 *
 * Standalone panel showing AI session turns from the output ledger.
 * Fetches GET /ai/history?orgId=&sessionId=
 *
 * Usage:
 *   <AIOutputLedgerPanel orgId="org-123" sessionId="sess-456" />
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Turn {
  intent:     string;
  response:   string;
  created_at: string;
}

// Inner data shape returned in ApiResponse.data
interface HistoryResponse {
  turns: Turn[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ── TurnCard ──────────────────────────────────────────────────────────────────

function TurnCard({ turn, index }: { turn: Turn; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = turn.response.length > 200 && !expanded
    ? `${turn.response.slice(0, 200)}…`
    : turn.response;

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">Turn {index + 1}</span>
        <span className="text-xs text-gray-400">{formatTime(turn.created_at)}</span>
      </div>

      {/* Intent */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-0.5">
          Intent
        </p>
        <p className="text-sm text-gray-800">{turn.intent}</p>
      </div>

      {/* Response */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
          AI Response
        </p>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{preview}</p>
        {turn.response.length > 200 && (
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-xs text-blue-500 hover:underline mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  orgId:      string;
  sessionId:  string;
  className?: string;
}

export function AIOutputLedgerPanel({ orgId, sessionId, className = '' }: Props) {
  const [turns,   setTurns]   = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchTurns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // API returns { success: true, data: { turns: [...] } }
      const res = (await apiClient.get<HistoryResponse>(
        `/ai/history?orgId=${orgId}&sessionId=${sessionId}`,
      )) as unknown as { data: HistoryResponse };
      setTurns(res?.data?.turns ?? []);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load AI ledger');
    } finally {
      setLoading(false);
    }
  }, [orgId, sessionId]);

  useEffect(() => { void fetchTurns(); }, [fetchTurns]);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">AI Output Ledger</h3>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{sessionId}</p>
        </div>
        <button
          onClick={() => void fetchTurns()}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
        ) : error ? (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error}
            <button onClick={() => void fetchTurns()} className="ml-2 underline text-red-700">
              Retry
            </button>
          </div>
        ) : turns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No AI outputs recorded for this session.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">{turns.length} turns</p>
            {turns.map((turn, i) => (
              <TurnCard key={i} turn={turn} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
