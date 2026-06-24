'use client';

/**
 * Pack Manager — /packs
 * Phase 8 (Pack Installer & Registry) / Phase 14 upgrade
 *
 * Lists all packs from the packs table.
 * - Sync button: POST /packs/sync
 * - Enable/Disable toggle per pack (owner/admin)
 * - Health badge: healthy / degraded / broken  [Phase 14]
 * - Version badge with previous_version hint    [Phase 14]
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pack {
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
}

interface PackHealth {
  packId:      string;
  status:      'healthy' | 'degraded' | 'broken';
  checkedAt:   string;
  totalNodes:  number;
  brokenNodes: { nodeType: string; resolvable: boolean; error?: string }[];
}

// ── Pack icon map ─────────────────────────────────────────────────────────────

const PACK_EMOJI: Record<string, string> = {
  'qsos.core-pack':          '⚙️',
  'qsos.qs-pack':            '📐',
  'qsos.procurement-pack':   '🛒',
  'qsos.document-pack':      '📄',
  'qsos.ai-pack':            '🤖',
  'lados.foundation-pack':   '🏗️',
  'lados.contractor-pack':   '🚛',
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, isEnabled }: { status: Pack['status']; isEnabled: boolean }) {
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

// ── Health badge (Phase 14) ───────────────────────────────────────────────────

function HealthBadge({ health }: { health: PackHealth | null | undefined }) {
  if (!health) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-100">
        ··· checking
      </span>
    );
  }
  if (health.status === 'healthy') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100"
        title={`${health.totalNodes} nodes healthy`}>
        ✓ Healthy
      </span>
    );
  }
  if (health.status === 'degraded') {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100"
        title={`${health.brokenNodes.length}/${health.totalNodes} nodes unrecognised`}>
        ⚠ Degraded
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100"
      title="No nodes resolvable">
      ✕ Broken
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PacksPage() {
  const [packs,    setPacks]    = useState<Pack[]>([]);
  const [health,   setHealth]   = useState<Record<string, PackHealth>>({});
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null);

  const loadPacks = useCallback(() => {
    setLoading(true);
    apiClient
      .get<Pack[]>('/packs')
      .then((res) => {
        const data = res.data ?? [];
        setPacks(data);
        // Phase 14: load health for all active packs in parallel (non-blocking)
        data.filter((p) => p.is_enabled).forEach((p) => {
          apiClient
            .get<PackHealth>(`/packs/${encodeURIComponent(p.id)}/health`)
            .then((r) => {
              if (r.data) {
                setHealth((prev) => ({ ...prev, [p.id]: r.data! }));
              }
            })
            .catch(() => { /* health badge stays in "checking" state */ });
        });
      })
      .catch(() => setError('Failed to load packs'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  // ── Sync ────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await apiClient.post<{ synced: string[]; skipped: string[]; errors: string[] }>(
        '/packs/sync',
      );
      const { synced, skipped, errors: errs } = res.data ?? { synced: [], skipped: [], errors: [] };
      setSyncMsg(
        `Synced: ${synced.length} updated, ${skipped.length} already current` +
        (errs.length ? `, ${errs.length} errors` : ''),
      );
      loadPacks();
    } catch {
      setSyncMsg('Sync failed — check API logs');
    } finally {
      setSyncing(false);
    }
  };

  // ── Enable / Disable ────────────────────────────────────────────────────

  const handleToggle = async (pack: Pack) => {
    setToggling(pack.id);
    try {
      const action = pack.is_enabled ? 'disable' : 'enable';
      await apiClient.patch(`/packs/${encodeURIComponent(pack.id)}/${action}`);
      loadPacks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Toggle failed';
      setError(msg);
    } finally {
      setToggling(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const activePacks   = packs.filter((p) =>  p.is_enabled);
  const disabledPacks = packs.filter((p) => !p.is_enabled);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Capability Packs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage installed packs. Each pack provides workflow nodes and resource capabilities.
          </p>
        </div>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <span className={syncing ? 'animate-spin' : ''}>⟳</span>
          {syncing ? 'Syncing…' : 'Sync Packs'}
        </button>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          {syncMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-400 text-center py-16">Loading packs…</div>
      )}

      {!loading && (
        <>
          {/* Stats bar */}
          <p className="text-xs text-gray-400 mb-5">
            <span className="font-semibold text-gray-700">{activePacks.length}</span> active ·{' '}
            <span className="font-semibold text-gray-700">{disabledPacks.length}</span> disabled ·{' '}
            {packs.length} total
          </p>

          {/* Pack grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packs.map((pack) => {
              const isToggling = toggling === pack.id;
              const packHealth = health[pack.id];
              return (
                <div
                  key={pack.id}
                  className={`group rounded-xl border bg-white transition-all ${
                    pack.is_enabled
                      ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                      : 'border-gray-100 opacity-60'
                  }`}
                >
                  {/* Card body — links to detail */}
                  <Link
                    href={`/packs/${encodeURIComponent(pack.id)}`}
                    className="block p-5"
                  >
                    {/* Top row: icon + badges */}
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: pack.color ? `${pack.color}22` : '#F3F4F6' }}
                      >
                        <span>{PACK_EMOJI[pack.id] ?? pack.icon ?? '📦'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {pack.is_official && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                            Official
                          </span>
                        )}
                        <StatusBadge status={pack.status} isEnabled={pack.is_enabled} />
                        {/* Phase 14: health badge */}
                        {pack.is_enabled && <HealthBadge health={packHealth} />}
                      </div>
                    </div>

                    {/* Name + version */}
                    <h2 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                      {pack.display_name}
                    </h2>
                    {/* Phase 14: version + previous_version */}
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                      v{pack.version}
                      {pack.previous_version && (
                        <span className="ml-1 text-[10px] text-gray-300">
                          (↑ from v{pack.previous_version})
                        </span>
                      )}
                      {' · '}{pack.author}
                    </p>

                    {/* Description */}
                    {pack.description && (
                      <p className="mt-2 text-xs text-gray-500 leading-snug line-clamp-2">
                        {pack.description}
                      </p>
                    )}

                    {/* Footer: node count */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">
                        <span className="font-semibold text-gray-700">{pack.node_count}</span>{' '}
                        node{pack.node_count !== 1 ? 's' : ''}
                      </span>
                      <span
                        className="text-[11px] font-medium group-hover:underline"
                        style={{ color: pack.color ?? '#3B82F6' }}
                      >
                        View →
                      </span>
                    </div>
                  </Link>

                  {/* Enable / Disable toggle */}
                  <div className="px-5 pb-4">
                    <button
                      onClick={() => handleToggle(pack)}
                      disabled={isToggling}
                      className={`w-full rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                        pack.is_enabled
                          ? 'border border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                          : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      } disabled:opacity-50`}
                    >
                      {isToggling
                        ? '…'
                        : pack.is_enabled
                          ? 'Disable'
                          : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
