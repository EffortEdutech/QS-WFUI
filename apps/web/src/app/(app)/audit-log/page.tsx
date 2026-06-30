'use client';

/**
 * AuditLogPage — Phase 11
 * Route: /audit-log
 *
 * Org-admin only page. Shows a filterable, paginated audit log table
 * with CSV export. Fetches the user's org from GET /organizations,
 * then queries GET /audit-log with filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id:   string;
  name: string;
  membership: { role: string };
}

interface AuditLogEntry {
  id:              string;
  organization_id: string | null;
  project_id:      string | null;
  actor_id:        string | null;
  event_type:      string;
  entity_type:     string | null;
  entity_id:       string | null;
  summary:         string;
  metadata:        Record<string, unknown> | null;
  created_at:      string;
}

interface ListResponse {
  success: boolean;
  data:    AuditLogEntry[];
  meta:    { total: number; limit: number; offset: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface Filters {
  actorId:    string;
  eventType:  string;
  entityType: string;
  from:       string;
  to:         string;
}

function FilterBar({
  filters,
  onChange,
  onApply,
  onReset,
}: {
  filters:  Filters;
  onChange: (f: Partial<Filters>) => void;
  onApply:  () => void;
  onReset:  () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Actor ID</label>
        <input
          type="text"
          value={filters.actorId}
          onChange={(e) => onChange({ actorId: e.target.value })}
          placeholder="user-uuid"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Event Type</label>
        <input
          type="text"
          value={filters.eventType}
          onChange={(e) => onChange({ eventType: e.target.value })}
          placeholder="workflow.published"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Entity Type</label>
        <input
          type="text"
          value={filters.entityType}
          onChange={(e) => onChange({ entityType: e.target.value })}
          placeholder="workflow"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <button
        onClick={onApply}
        className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
      <button
        onClick={onReset}
        className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
      >
        Reset
      </button>
    </div>
  );
}

// ── MetadataCell ──────────────────────────────────────────────────────────────

function MetadataCell({ data }: { data: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-blue-500 hover:underline"
      >
        {open ? 'Hide' : 'View'}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words max-w-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = {
  actorId:    '',
  eventType:  '',
  entityType: '',
  from:       '',
  to:         '',
};

export default function AuditLogPage() {
  const [org,      setOrg]      = useState<Organization | null>(null);
  const [entries,  setEntries]  = useState<AuditLogEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [filters,  setFilters]  = useState<Filters>(EMPTY_FILTERS);
  const [applied,  setApplied]  = useState<Filters>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState(false);

  // ── Fetch org ──────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const orgs = await apiClient.get<Organization[]>('/organizations');
        const orgList = orgs?.data ?? [];
        if (orgList.length) setOrg(orgList[0]);
      } catch {
        setError('Failed to load organisation');
        setLoading(false);
      }
    })();
  }, []);

  // ── Fetch log entries ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async (
    orgId:   string,
    f:       Filters,
    pageNum: number,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('organizationId', orgId);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(pageNum * PAGE_SIZE));
      if (f.actorId)    params.set('actorId',    f.actorId);
      if (f.eventType)  params.set('eventType',  f.eventType);
      if (f.entityType) params.set('entityType', f.entityType);
      if (f.from)       params.set('from',       `${f.from}T00:00:00Z`);
      if (f.to)         params.set('to',         `${f.to}T23:59:59Z`);

      // API returns { success, data: AuditLogEntry[], meta: { total, limit, offset } }
      // Cast via unknown to access non-standard meta field
      const res = (await apiClient.get<AuditLogEntry[]>(
        `/audit-log?${params.toString()}`,
      )) as unknown as ListResponse;
      setEntries(res?.data ?? []);
      setTotal(res?.meta?.total ?? 0);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (org) void fetchEntries(org.id, applied, page);
  }, [org, applied, page, fetchEntries]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApply = () => {
    setPage(0);
    setApplied({ ...filters });
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(0);
  };

  const handleExport = async () => {
    if (!org) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ organizationId: org.id });
      if (applied.actorId)    params.set('actorId',    applied.actorId);
      if (applied.eventType)  params.set('eventType',  applied.eventType);
      if (applied.entityType) params.set('entityType', applied.entityType);
      if (applied.from)       params.set('from',       `${applied.from}T00:00:00Z`);
      if (applied.to)         params.set('to',         `${applied.to}T23:59:59Z`);

      // Use fetch directly for blob download
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
      const res   = await fetch(
        `${API_BASE}/audit-log/export?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  const role = org?.membership?.role;
  const canView = role === 'owner' || role === 'admin';

  if (error && !org) {
    return (
      <div className="p-8 text-red-600 text-sm">{error}</div>
    );
  }

  if (org && !canView) {
    return (
      <div className="p-8 text-gray-500 text-sm">
        Audit log is only available to organisation owners and admins.
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {org ? `Organisation: ${org.name}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => void handleExport()}
          disabled={exporting || !org}
          className="px-4 py-2 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
        onApply={handleApply}
        onReset={handleReset}
      />

      {/* Summary */}
      {!loading && !error && (
        <p className="text-xs text-gray-500 mb-3">
          {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
          {total > 0 && ` — page ${page + 1} of ${totalPages}`}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No audit log entries match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium w-44">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Event Type</th>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium">Actor</th>
                  <th className="text-left px-4 py-3 font-medium">Summary</th>
                  <th className="text-left px-4 py-3 font-medium w-20">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {e.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {e.entity_type ? (
                        <>
                          <span className="font-medium">{e.entity_type}</span>
                          {e.entity_id && (
                            <span className="text-gray-400 block truncate max-w-[120px]" title={e.entity_id}>
                              {e.entity_id.slice(0, 8)}…
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 truncate max-w-[120px]">
                      {e.actor_id ? (
                        <span title={e.actor_id}>{e.actor_id.slice(0, 8)}…</span>
                      ) : (
                        <span className="text-gray-300">system</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                      {e.summary}
                    </td>
                    <td className="px-4 py-3">
                      <MetadataCell data={e.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
