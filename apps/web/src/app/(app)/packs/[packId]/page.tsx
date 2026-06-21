'use client';

/**
 * Pack Detail — /packs/[packId]
 * Updated Phase 8 — uses GET /packs/:id (PackController)
 *
 * Shows pack header (name, publisher, version, description, status),
 * the full node list for this pack, and dependency chips.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackNode {
  type:           string;
  name:           string;
  description:    string | null;
  category:       string;
  icon:           string | null;
  color:          string | null;
  uses_services?: string[];
  data_pack_deps?: string[];
  is_enabled?:    boolean;
}

interface PackDetail {
  id:           string;
  display_name: string;
  description:  string | null;
  author:       string;
  version:      string;
  icon:         string | null;
  color:        string | null;
  is_official:  boolean;
  is_enabled:   boolean;
  status:       'active' | 'disabled' | 'error';
  dependencies: string[];
  node_count:   number;
  nodes:        PackNode[];
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

// ── Component ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { packId: string };
}

export default function PackDetailPage({ params }: PageProps) {
  const packId = decodeURIComponent(params.packId);

  const [pack,    setPack]    = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PackDetail>(`/packs/${encodeURIComponent(packId)}`)
      .then((res) => setPack(res.data ?? null))
      .catch(() => setError('Failed to load pack details'))
      .finally(() => setLoading(false));
  }, [packId]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 text-center py-16">Loading…</div>;
  }
  if (error || !pack) {
    return (
      <div className="p-6 text-sm text-red-500 text-center py-16">
        {error ?? 'Pack not found'}
      </div>
    );
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{pack.display_name}</h1>
              {pack.is_official && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                  Official
                </span>
              )}
              <StatusBadge status={pack.status} isEnabled={pack.is_enabled} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              {pack.id} · v{pack.version} · by {pack.author}
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
        <h2 className="text-sm font-semibold text-gray-700">Nodes in this pack</h2>

        {nodes.length === 0 && (
          <p className="text-sm text-gray-400 italic">No nodes registered for this pack yet.</p>
        )}

        {[...grouped.entries()].map(([category, catNodes]) => (
          <div key={category}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 capitalize">
              {category}
            </h3>
            <div className="space-y-2">
              {catNodes.map((node) => (
                <div
                  key={node.type}
                  className={`rounded-lg border bg-white px-4 py-3 flex items-start gap-3 ${
                    node.is_enabled === false ? 'opacity-50' : 'border-gray-200'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className="h-7 w-7 rounded flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{node.name}</p>
                    <p className="text-[10px] font-mono text-gray-400">{node.type}</p>
                    {node.description && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{node.description}</p>
                    )}
                    {/* Service chips */}
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
                  {/* Disabled chip */}
                  {node.is_enabled === false && (
                    <span className="text-[9px] text-gray-400 self-start mt-0.5 bg-gray-100 rounded px-1.5 py-0.5">
                      disabled
                    </span>
                  )}
                </div>
              ))}
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
