'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

interface DataPackItem {
  id: string;
  itemKey: string;
  title: string;
  unit: string | null;
  sourceName: string;
  sourceDate: string | null;
  region: string | null;
  classification: string | null;
  pack: { slug: string; displayName: string } | null;
  collection: { key: string; displayName: string } | null;
}

export default function DataPackItemField({
  field,
  value,
  onChange,
  organizationId,
}: FieldProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DataPackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collection = field.dataPackCollection ?? field.ui?.dataPackCollection;
  const packSlug = field.dataPackSlug ?? field.ui?.dataPackSlug;
  const selected = useMemo(
    () => items.find((item) => item.id === value),
    [items, value],
  );

  useEffect(() => {
    if (!organizationId) return;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ organizationId, limit: '20' });
      if (query.trim()) params.set('q', query.trim());
      if (collection) params.set('collection', collection);
      if (packSlug) params.set('packSlug', packSlug);

      const res = await apiClient.get<DataPackItem[]>(`/data-pack-items/search?${params.toString()}`);
      if (res.success) {
        setItems(res.data ?? []);
        setError(null);
      } else {
        setError(res.error?.message ?? 'Failed to search Data Pack items');
      }
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [collection, organizationId, packSlug, query]);

  return (
    <FieldWrapper field={field}>
      {!organizationId && (
        <p className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          Select an organization before choosing a Data Pack item.
        </p>
      )}

      {organizationId && (
        <div className="space-y-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={field.placeholder ?? 'Search installed Data Pack items...'}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
          />

          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(field.key, event.target.value || undefined)}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="">{loading ? 'Searching...' : 'Choose Data Pack item'}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>

          {error && <p className="text-[11px] leading-snug text-red-600">{error}</p>}

          {selected && (
            <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
              <p className="font-semibold">{selected.pack?.displayName ?? 'Data Pack'} / {selected.collection?.displayName ?? 'Item'}</p>
              <p className="mt-0.5">
                Source: {selected.sourceName}
                {selected.sourceDate ? ` · ${selected.sourceDate}` : ''}
                {selected.region ? ` · ${selected.region}` : ''}
                {selected.unit ? ` · ${selected.unit}` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
