'use client';
/**
 * StateHistoryTimeline — Phase 3D
 *
 * Renders an ordered timeline of resource state-transition events.
 * Fetches from GET /resources/:id/history (backed by lados_resource_events).
 * Shows newest events at the top.
 *
 * Usage:
 *   <StateHistoryTimeline resourceId={id} orgId={orgId} />
 */

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id:          string;
  resource_id: string;
  event_type:  string;
  from_state:  string | null;
  to_state:    string | null;
  actor_id:    string | null;
  metadata:    Record<string, unknown>;
  created_at:  string;
}

export interface StateHistoryTimelineProps {
  resourceId: string;
  orgId:      string;
  /** Max entries to show (default: unlimited) */
  limit?:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(delta / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function stateLabel(s: string | null): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StateHistoryTimeline({
  resourceId,
  orgId,
  limit,
}: StateHistoryTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId || !orgId) return;

    setLoading(true);
    setError(null);

    void apiClient
      .get<HistoryEntry[]>(`/resources/${resourceId}/history?organizationId=${orgId}`)
      .then((res) => {
        if (res.success && res.data) {
          // Oldest first from API (ascending created_at); reverse for newest-first display
          const entries = [...res.data].reverse();
          setHistory(limit ? entries.slice(0, limit) : entries);
        } else {
          setError('Failed to load history');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [resourceId, orgId, limit]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-3 w-3 mt-1 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <p className="py-4 text-sm text-red-500">
        Could not load history: {error}
      </p>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────

  if (!history.length) {
    return (
      <p className="py-4 text-sm text-gray-500">No state history recorded yet.</p>
    );
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  return (
    <ol className="relative border-l border-gray-200 pl-4 space-y-5">
      {history.map((entry, idx) => (
        <li key={entry.id} className="relative">
          {/* Timeline dot */}
          <span
            className={[
              'absolute -left-[1.3125rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-white',
              idx === 0 ? 'bg-blue-500' : 'bg-gray-300',
            ].join(' ')}
          />

          {/* Timestamp */}
          <time className="block text-[11px] text-gray-400 leading-none mb-0.5">
            {relativeTime(entry.created_at)}
          </time>

          {/* Transition label */}
          <p className="text-sm font-medium text-gray-900">
            {entry.from_state ? (
              <>
                <span className="text-gray-500">{stateLabel(entry.from_state)}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span>{stateLabel(entry.to_state)}</span>
              </>
            ) : (
              <span>{stateLabel(entry.to_state) ?? entry.event_type}</span>
            )}
          </p>

          {/* Actor */}
          {entry.actor_id && (
            <p className="mt-0.5 text-[11px] text-gray-400 truncate">
              by{' '}
              <span className="font-mono">{entry.actor_id.slice(0, 8)}…</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
