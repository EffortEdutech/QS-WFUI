'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface PackRecord {
  id: string;
  display_name: string;
  description: string | null;
  version: string;
  icon: string | null;
  color: string | null;
  is_official: boolean;
  is_enabled: boolean;
  status: 'active' | 'disabled' | 'error';
  node_count: number;
}

interface PackNode {
  type: string;
  name: string;
  category: string | null;
  description?: string | null;
}

interface PackDetail extends PackRecord {
  nodes: PackNode[];
}

interface ExplorerPacksTabProps {
  search: string;
}

function packStatus(pack: PackRecord): { label: string; className: string } {
  if (!pack.is_enabled || pack.status === 'disabled') {
    return { label: 'Disabled', className: 'bg-gray-100 text-gray-500' };
  }
  if (pack.status === 'error') {
    return { label: 'Needs check', className: 'bg-red-50 text-red-600' };
  }
  return { label: 'Healthy', className: 'bg-green-50 text-green-700' };
}

export default function ExplorerPacksTab({ search }: ExplorerPacksTabProps) {
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [packNodes, setPackNodes] = useState<Record<string, PackNode[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingNodes, setLoadingNodes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PackRecord[]>('/packs')
      .then((res) => {
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to load packs');
          return;
        }
        setPacks(res.data ?? []);
      })
      .catch(() => setError('Failed to load packs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return packs;
    return packs.filter((pack) =>
      pack.display_name.toLowerCase().includes(term) ||
      pack.id.toLowerCase().includes(term) ||
      (pack.description ?? '').toLowerCase().includes(term),
    );
  }, [packs, search]);

  const togglePack = async (packId: string) => {
    const next = expandedPackId === packId ? null : packId;
    setExpandedPackId(next);
    if (!next || packNodes[packId]) return;

    setLoadingNodes(packId);
    try {
      const res = await apiClient.get<PackDetail>(`/packs/${encodeURIComponent(packId)}`);
      if (res.success && res.data) {
        setPackNodes((current) => ({ ...current, [packId]: res.data?.nodes ?? [] }));
      }
    } finally {
      setLoadingNodes(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white text-xs">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {packs.length} packs installed
        </span>
        <div className="flex items-center gap-2">
          <Link href="/packs" className="text-[10px] font-medium text-blue-500 hover:text-blue-700">
            Manage
          </Link>
          <Link href="/marketplace" className="text-[10px] font-medium text-blue-500 hover:text-blue-700">
            Market
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="py-6 text-center text-xs text-gray-400">Loading packs...</p>}
        {error && <p className="py-6 text-center text-xs text-red-500">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">No packs found</p>
        )}

        {!loading && !error && filtered.map((pack) => {
          const status = packStatus(pack);
          const expanded = expandedPackId === pack.id;
          const nodes = packNodes[pack.id] ?? [];

          return (
            <div key={pack.id} className="mb-2 rounded border border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => void togglePack(pack.id)}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-blue-50"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: pack.color ?? '#64748b' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-gray-800">{pack.display_name}</span>
                      {pack.is_official && (
                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600">
                          Official
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-gray-400">
                      {pack.node_count} nodes · v{pack.version}
                    </p>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-gray-200 bg-white px-3 py-2">
                  {loadingNodes === pack.id && (
                    <p className="py-2 text-[10px] text-gray-400">Loading nodes...</p>
                  )}
                  {loadingNodes !== pack.id && nodes.length === 0 && (
                    <p className="py-2 text-[10px] text-gray-400">No nodes registered</p>
                  )}
                  {nodes.map((node) => (
                    <div key={node.type} className="border-b border-gray-50 py-1.5 last:border-0">
                      <p className="truncate text-[11px] font-medium text-gray-700">{node.name}</p>
                      <p className="truncate font-mono text-[9px] text-gray-400">{node.type}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
