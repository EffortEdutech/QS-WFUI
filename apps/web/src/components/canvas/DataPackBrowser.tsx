'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface DataPackSummary {
  slug: string;
  displayName: string;
  description: string | null;
  region: string | null;
  category: string | null;
  domain: string | null;
  installedVersion?: { version: string } | null;
}

interface DataPackItem {
  id: string;
  itemKey: string;
  title: string;
  description: string | null;
  unit: string | null;
  tags: string[];
  sourceName: string;
  sourceDate: string | null;
  region: string | null;
  classification: string | null;
  applicabilityNotes: string | null;
  assumptions: string | null;
  advisoryStatus: string;
  pack: { slug: string; displayName: string } | null;
  collection: { key: string; displayName: string } | null;
}

interface DataPackBrowserProps {
  organizationId: string;
  search?: string;
}

export default function DataPackBrowser({ organizationId, search = '' }: DataPackBrowserProps) {
  const [installed, setInstalled] = useState<DataPackSummary[]>([]);
  const [items, setItems] = useState<DataPackItem[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [collection, setCollection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = search.trim() || localSearch.trim();
  const collections = useMemo(() => {
    const keys = new Set(items.map((item) => item.collection?.key).filter(Boolean) as string[]);
    return [...keys].sort();
  }, [items]);

  const loadInstalled = useCallback(async () => {
    if (!organizationId) return;
    const res = await apiClient.get<DataPackSummary[]>(`/org/data-packs?organizationId=${encodeURIComponent(organizationId)}`);
    if (res.success) {
      setInstalled(res.data ?? []);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Failed to load installed Data Packs');
    }
  }, [organizationId]);

  const searchItems = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const params = new URLSearchParams({
      organizationId,
      limit: '40',
    });
    if (query) params.set('q', query);
    if (collection) params.set('collection', collection);

    const res = await apiClient.get<DataPackItem[]>(`/data-pack-items/search?${params.toString()}`);
    if (res.success) {
      setItems(res.data ?? []);
      setError(null);
    } else {
      setError(res.error?.message ?? 'Failed to search Data Pack items');
    }
    setLoading(false);
  }, [collection, organizationId, query]);

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  useEffect(() => {
    void searchItems();
  }, [searchItems]);

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex-shrink-0 border-b border-gray-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Data Packs
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-gray-400">
          Search installed governed datasets and provenance.
        </p>
      </div>

      <div className="flex-shrink-0 space-y-2 border-b border-gray-100 p-3">
        <input
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          placeholder={search ? 'Using Explorer search...' : 'Search rate, BOQ, evidence...'}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
        />
        <select
          value={collection}
          onChange={(event) => setCollection(event.target.value)}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          <option value="">All collections</option>
          {collections.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mx-3 mt-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-[10px] leading-snug text-red-700">
          {error}
        </div>
      )}

      <div className="flex-shrink-0 border-b border-gray-100 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Installed ({installed.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {installed.length === 0 && (
            <span className="text-[10px] text-gray-400">Install Data Packs from Marketplace.</span>
          )}
          {installed.slice(0, 6).map((pack) => (
            <span
              key={pack.slug}
              title={pack.displayName}
              className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
            >
              {pack.category ?? pack.slug}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && <p className="py-5 text-center text-xs text-gray-400">Searching Data Packs...</p>}

        {!loading && items.length === 0 && (
          <p className="rounded border border-dashed border-gray-200 px-3 py-5 text-center text-xs leading-5 text-gray-400">
            No Data Pack items found.
          </p>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <article key={item.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-gray-400">
                    {item.pack?.slug ?? 'data-pack'} / {item.collection?.key ?? 'items'}
                  </p>
                </div>
                {item.unit && (
                  <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                    {item.unit}
                  </span>
                )}
              </div>

              {item.description && (
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-500">
                  {item.description}
                </p>
              )}

              <div className="mt-2 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] leading-snug text-amber-800">
                Source: {item.sourceName}
                {item.sourceDate ? ` · ${item.sourceDate}` : ''}
                {item.region ? ` · ${item.region}` : ''}
              </div>

              {item.assumptions && (
                <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-gray-400">
                  {item.assumptions}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}
