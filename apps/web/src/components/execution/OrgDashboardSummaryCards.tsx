'use client';

/**
 * OrgDashboardSummaryCards — Phase 11
 *
 * Four live summary cards for the owner/admin dashboard:
 *   1. Active runs         — GET /execution/summary
 *   2. Pending approvals   — GET /approvals (counts pending tasks)
 *   3. Enabled packs       — GET /org/packs
 *   4. Recent events       — GET /events?organizationId=&limit=3
 *
 * Props:
 *   orgId — the current user's organisation id
 *
 * Usage:
 *   <OrgDashboardSummaryCards orgId={org.id} />
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunSummary {
  running:     number;
  failed24h:   number;
  completed7d: number;
}

interface ApprovalTask {
  id:     string;
  status: string;
}

interface OrgPack {
  id:         string;
  is_enabled: boolean;
}

interface EventEntry {
  id:         string;
  event_type: string;
  summary?:   string;
  created_at: string;
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  href,
  accent,
  loading,
}: {
  icon:    string;
  label:   string;
  value:   string | number;
  sub?:    string;
  href?:   string;
  accent:  string;
  loading: boolean;
}) {
  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${accent}`}>
            {loading ? '—' : value}
          </p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
      {href && (
        <p className="mt-3 text-xs text-blue-500 hover:text-blue-600">View all →</p>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ── RecentEventsCard ──────────────────────────────────────────────────────────

function RecentEventsCard({
  events,
  loading,
}: {
  events:  EventEntry[];
  loading: boolean;
}) {
  function relTime(iso: string): string {
    const delta = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(delta / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Events</p>
        <Link href="/operations" className="text-xs text-blue-500 hover:text-blue-600">
          View all →
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400 py-3">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No recent events.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between py-2 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 truncate">
                  <span className="font-medium text-blue-600">{e.event_type}</span>
                </p>
                {e.summary && (
                  <p className="text-xs text-gray-400 truncate">{e.summary}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{relTime(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
}

export function OrgDashboardSummaryCards({ orgId }: Props) {
  const [runSummary,    setRunSummary]    = useState<RunSummary | null>(null);
  const [pendingCount,  setPendingCount]  = useState<number>(0);
  const [enabledPacks,  setEnabledPacks]  = useState<number>(0);
  const [recentEvents,  setRecentEvents]  = useState<EventEntry[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!orgId) return;

    void (async () => {
      setLoading(true);
      try {
        // apiClient.get<T> returns ApiResponse<T> = { success, data: T }
        // Controllers that wrap: data is in .data
        // Controllers that don't wrap (e.g. listPending): value is the raw payload
        const [runRes, approvalRes, packsRes, eventsRes] = await Promise.allSettled([
          apiClient.get<RunSummary>(`/execution/summary?organizationId=${orgId}`),
          apiClient.get<ApprovalTask[]>('/approvals'),
          apiClient.get<OrgPack[]>(`/org/packs?organizationId=${orgId}`),
          apiClient.get<EventEntry[]>(`/events?organizationId=${orgId}&limit=5`),
        ]);

        if (runRes.status === 'fulfilled') {
          // { success: true, data: RunSummary }
          setRunSummary((runRes.value as unknown as { data: RunSummary }).data ?? null);
        }
        if (approvalRes.status === 'fulfilled') {
          // listPending returns plain array (no wrapper)
          const raw = approvalRes.value as unknown;
          const tasks: ApprovalTask[] = Array.isArray(raw)
            ? (raw as ApprovalTask[])
            : ((raw as { data?: ApprovalTask[] }).data ?? []);
          setPendingCount(tasks.length);
        }
        if (packsRes.status === 'fulfilled') {
          // { success: true, data: OrgPack[] }
          const packs: OrgPack[] =
            (packsRes.value as unknown as { data?: OrgPack[] }).data ?? [];
          setEnabledPacks(packs.filter((p) => p.is_enabled).length);
        }
        if (eventsRes.status === 'fulfilled') {
          // { success: true, data: EventEntry[] }
          const events: EventEntry[] =
            (eventsRes.value as unknown as { data?: EventEntry[] }).data ?? [];
          setRecentEvents(events);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Organisation Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <SummaryCard
          icon="⚡"
          label="Active Runs"
          value={runSummary?.running ?? 0}
          sub={runSummary ? `${runSummary.failed24h} failed today` : undefined}
          href="/operations"
          accent={
            (runSummary?.running ?? 0) > 0
              ? 'text-blue-600'
              : 'text-gray-400'
          }
          loading={loading}
        />
        <SummaryCard
          icon="⏳"
          label="Pending Approvals"
          value={pendingCount}
          href="/approvals"
          accent={pendingCount > 0 ? 'text-yellow-600' : 'text-gray-400'}
          loading={loading}
        />
        <SummaryCard
          icon="📦"
          label="Enabled Packs"
          value={enabledPacks}
          href="/marketplace"
          accent="text-purple-600"
          loading={loading}
        />
        <SummaryCard
          icon="✅"
          label="Completed (7d)"
          value={runSummary?.completed7d ?? 0}
          accent="text-green-600"
          loading={loading}
        />
      </div>

      {/* Recent events row */}
      <div className="grid grid-cols-1">
        <RecentEventsCard events={recentEvents} loading={loading} />
      </div>
    </div>
  );
}
