'use client';

/**
 * Pack Detail — /packs/[packId]
 * Phase 8 / Phase 14 upgrade
 *
 * Shows pack header (name, publisher, version, previous_version, description, status),
 * health check result, the full node list with per-org enable/disable toggles,
 * and dependency chips.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackNode {
  type:            string;
  name:            string;
  description:     string | null;
  category:        string;
  icon:            string | null;
  color:           string | null;
  uses_services?:  string[];
  data_pack_deps?: string[];
  is_enabled?:     boolean;
}

interface PackDetail {
  id:               string;
  display_name:     string;
  description:      string | null;
  author:           string;
  version:          string;
  previous_version: string | null;
  icon:             string | null;
  color:            string | null;
  is_official:      boolean;
  is_enabled:       boolean;
  status:           'active' | 'disabled' | 'error';
  dependencies:     string[];
  node_count:       number;
  nodes:            PackNode[];
}

interface PackHealth {
  packId:      string;
  status:      'healthy' | 'degraded' | 'broken';
  checkedAt:   string;
  totalNodes:  number;
  brokenNodes: { nodeType: string; resolvable: boolean; error?: string }[];
}

interface NodeOverride {
  node_type:  string;
  is_enabled: boolean;
}

const PACK_EMOJI: Record<string, string> = {
  'qsos.core-pack':          '⚙️',
  'qsos.qs-pack':            '📐',
  'qsos.procurement-pack':   '🛒',
  'qsos.document-pack':      '📄',
  'qsos.ai-pack':            '🤖',
  'lados.foundation-pack':   '🏗️',
  'lados.contractor-pack':   '🚛',
};

const CATEGORY_ORDER = ['control', 'input', 'processing', 'output', 'ai', 'approval', 'notification', 'user'];

function groupByCategory(nodes: PackNode[]): Map<string, PackNode[]> {
  const map = new Map<string, PackNode[]>();
  for (const n of nodes) {
    const cat = n.category ?? 'other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(n);
  }
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }),
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status, isEnabled }: { status: PackDetail['status']; isEnabled: boolean }) {
  if (!isEnabled || status === 'disabled') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
        Disabled
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
        Error
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
      Active
    </span>
  );
}

function HealthBadge({ health }: { health: PackHealth | null }) {
  if (!health) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-100">
        ··· checking health
      </span>
    );
  }
  const checkedAt = new Date(health.checkedAt).toLocaleTimeString();
  if (health.status === 'healthy') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100"
        title={`${health.totalNodes} nodes healthy · checked at ${checkedAt}`}
      >
        ✓ Healthy — {health.totalNodes} nodes
      </span>
    );
  }
  if (health.status === 'degraded') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100"
        title={`${health.brokenNodes.length}/${health.totalNodes} nodes unrecognised · checked at ${checkedAt}`}
      >
        ⚠ Degraded — {health.brokenNodes.length}/{health.totalNodes} unrecognised
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100"
      title={`No nodes resolvable · checked at ${checkedAt}`}
    >
      ✕ Broken
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { packId: string };
}

export default function PackDetailPage({ params }: PageProps) {
  const packId = decodeURIComponent(params.packId);

  const [pack,      setPack]      = useState<PackDetail | null>(null);
  const [health,    setHealth]    = useState<PackHealth | null>(null);
  const [orgId,     setOrgId]     = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});  // nodeType → is_enabled
  const [toggling,  setToggling]  = useState<string | null>(null);           // nodeType being toggled
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const loadOverrides = useCallback(async (oid: string) => {
    try {
      const res = await apiClient.get<NodeOverride[]>(
        `/packs/${encodeURIComponent(packId)}/node-overrides?organizationId=${oid}`,
      );
      const map: Record<string, boolean> = {};
      for (const o of res.data ?? []) {
        map[o.node_type] = o.is_enabled;
      }
      setOverrides(map);
    } catch {
      // overrides not available — all nodes shown as enabled
    }
  }, [packId]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Load pack detail
        const packRes = await apiClient.get<PackDetail>(`/packs/${encodeURIComponent(packId)}`);
        setPack(packRes.data ?? null);

        // Load health (non-blocking)
        apiClient.get<PackHealth>(`/packs/${encodeURIComponent(packId)}/health`)
          .then((r) => setHealth(r.data ?? null))
          .catch(() => {});

        // Load org + overrides
        const orgRes = await apiClient.get<{ id: string }[]>('/organizations');
        const firstOrg = orgRes.data?.[0];
        if (firstOrg) {
          setOrgId(firstOrg.id);
          await loadOverrides(firstOrg.id);
        }
      } catch {
        setError('Failed to load pack details');
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, [packId, loadOverrides]);

  // ── Node toggle ─────────────────────────────────────────────────────────

  const handleNodeToggle = async (nodeType: string) => {
    if (!orgId) return;
    const isCurrentlyEnabled = overrides[nodeType] !== false; // default enabled
    setToggling(nodeType);
    try {
      const action = isCurrentlyEnabled ? 'disable' : 'enable';
      await apiClient.patch(
        `/packs/${encodeURIComponent(packId)}/nodes/${encodeURIComponent(nodeType)}/${action}?organizationId=${orgId}`,
      );
      await loadOverrides(orgId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update node override');
    } finally {
      setToggling(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 text-center py-16">Loading…</div>;
  }
  if (error && !pack) {
    return (
      <div className="p-6 text-sm text-red-500 text-center py-16">{error}</div>
    );
  }
  if (!pack) {
    return <div className="p-6 text-sm text-gray-400 text-center py-16">Pack not found</div>;
  }

  const nodes   = pack.nodes ?? [];
  const grouped = groupByCategory(nodes);
  const allDataPackDeps = [...new Set(nodes.flatMap((n) => n.data_pack_deps ?? []))];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/packs" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ← Capability Packs
      </Link>

      {/* Error toast */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      {/* Pack header */}
      <div
        className="mt-4 rounded-xl border p-6"
        style={{
          borderColor: pack.color ? `${pack.color}44` : '#E5E7EB',
          background:  pack.color ? `${pack.color}08`  : undefined,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
          >
            {PACK_EMOJI[pack.id] ?? pack.icon ?? '📦'}
          </div>
          <div className="flex-1 min-w-0">
            {/* Name + badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{pack.display_name}</h1>
              {pack.is_official && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                  Official
                </span>
              )}
              <StatusBadge status={pack.status} isEnabled={pack.is_enabled} />
              {/* Phase 14: health badge */}
              <HealthBadge health={health} />
            </div>

            {/* Phase 14: version line with previous_version */}
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              {pack.id} · v{pack.version}
              {pack.previous_version && (
                <span className="ml-1 text-[10px] text-gray-300">
                  (upgraded from v{pack.previous_version})
                </span>
              )}
              {' · '}by {pack.author}
            </p>

            {pack.description && (
              <p className="mt-2 text-sm text-gray-600">{pack.description}</p>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span>
                <span className="font-semibold text-gray-700">{nodes.length}</span> nodes
              </span>
              {pack.dependencies.length > 0 && (
                <span>
                  <span className="font-semibold text-gray-700">{pack.dependencies.length}</span> dependencies
                </span>
              )}
              {orgId && (
                <span className="text-[10px] text-gray-400">
                  Node overrides applied per-org
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dependencies */}
        {pack.dependencies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mr-1 self-center">Requires:</span>
            {pack.dependencies.map((dep) => (
              <Link
                key={dep}
                href={`/packs/${encodeURIComponent(dep)}`}
                className="rounded px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                {dep}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nodes by category */}
      <div className="mt-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Nodes in this pack</h2>
          {orgId && (
            <p className="text-[10px] text-gray-400">
              Toggles apply to your organisation only
            </p>
          )}
        </div>

        {nodes.length === 0 && (
          <p className="text-sm text-gray-400 italic">No nodes registered for this pack yet.</p>
        )}

        {[...grouped.entries()].map(([category, catNodes]) => (
          <div key={category}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 capitalize">
              {category}
            </h3>
            <div className="space-y-2">
              {catNodes.map((node) => {
                // Org override takes precedence; fall back to pack-level is_enabled
                const orgEnabled = overrides[node.type] !== undefined
                  ? overrides[node.type]
                  : (node.is_enabled !== false);
                const isTogglingThis = toggling === node.type;

                return (
                  <div
                    key={node.type}
                    className={`rounded-lg border bg-white px-4 py-3 flex items-center gap-3 transition-opacity ${
                      !orgEnabled ? 'opacity-50 border-gray-100' : 'border-gray-200'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="h-7 w-7 rounded flex items-center justify-center text-sm flex-shrink-0"
                      style={{
                        backgroundColor: (node.color ?? pack.color)
                          ? `${node.color ?? pack.color}22`
                          : '#F3F4F6',
                      }}
                    >
                      {node.icon ?? (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: node.color ?? pack.color ?? '#6B7280' }}
                        />
                      )}
                    </div>

                    {/* Node info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{node.name}</p>
                      <p className="text-[10px] font-mono text-gray-400">{node.type}</p>
                      {node.description && (
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{node.description}</p>
                      )}
                      {node.uses_services && node.uses_services.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {node.uses_services.map((svc) => (
                            <span
                              key={svc}
                              className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600 border border-blue-100"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phase 14: per-org enable/disable toggle */}
                    {orgId && (
                      <button
                        onClick={() => handleNodeToggle(node.type)}
                        disabled={isTogglingThis}
                        className={`flex-shrink-0 rounded px-2.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                          orgEnabled
                            ? 'border border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                        title={orgEnabled ? `Disable ${node.type} for this org` : `Enable ${node.type} for this org`}
                      >
                        {isTogglingThis ? '…' : orgEnabled ? 'Disable' : 'Enable'}
                      </button>
                    )}

                    {/* Disabled chip (no org context) */}
                    {!orgId && node.is_enabled === false && (
                      <span className="text-[9px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">
                        disabled
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Data Pack dependencies */}
      {allDataPackDeps.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Optional Data Pack dependencies</h2>
          <div className="flex flex-wrap gap-2">
            {allDataPackDeps.map((slug) => (
              <span
                key={slug}
                className="rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100"
              >
                📦 {slug}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
