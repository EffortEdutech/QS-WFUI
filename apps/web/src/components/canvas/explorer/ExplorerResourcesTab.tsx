'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface ResourceRecord {
  id: string;
  type: string;
  name: string;
  state: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ExplorerResourcesTabProps {
  organizationId: string;
  projectId: string;
  search: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-MY');
}

function resourceIcon(type: string): string {
  if (type.includes('invoice')) return 'INV';
  if (type.includes('payment')) return 'PAY';
  if (type.includes('contract')) return 'CON';
  if (type.includes('boq')) return 'BOQ';
  if (type.includes('vehicle')) return 'VEH';
  if (type.includes('material')) return 'MAT';
  return 'RES';
}

export default function ExplorerResourcesTab({
  organizationId,
  projectId,
  search,
}: ExplorerResourcesTabProps) {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const params = new URLSearchParams({ organizationId, projectId });
    setLoading(true);
    setError(null);
    apiClient
      .get<ResourceRecord[]>(`/resources?${params}`)
      .then((res) => {
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to load resources');
          return;
        }
        setResources(res.data ?? []);
      })
      .catch(() => setError('Failed to load resources'))
      .finally(() => setLoading(false));
  }, [organizationId, projectId]);

  const resourceTypes = useMemo(
    () => Array.from(new Set(resources.map((r) => r.type))).sort(),
    [resources],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesType = typeFilter === 'all' || resource.type === typeFilter;
      const matchesSearch =
        !term ||
        resource.name.toLowerCase().includes(term) ||
        resource.type.toLowerCase().includes(term) ||
        resource.state.toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
  }, [resources, search, typeFilter]);

  const handleDragStart = (event: React.DragEvent, resource: ResourceRecord) => {
    event.dataTransfer.setData('application/lados-resource-id', resource.id);
    event.dataTransfer.setData('application/lados-resource-type', resource.type);
    event.dataTransfer.setData('text/plain', resource.name);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full flex-col bg-white text-xs">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 focus:border-blue-400 focus:outline-none"
        >
          <option value="all">All resources</option>
          {resourceTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="py-6 text-center text-xs text-gray-400">Loading resources...</p>}
        {error && <p className="py-6 text-center text-xs text-red-500">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs font-medium text-gray-500">No resources found</p>
            <p className="mt-1 text-[10px] leading-snug text-gray-400">
              Create or bind project resources from the Resources page.
            </p>
          </div>
        )}

        {!loading && !error && filtered.map((resource) => (
          <a
            key={resource.id}
            href={`/resources?resourceId=${resource.id}`}
            target="_blank"
            rel="noreferrer"
            draggable
            onDragStart={(event) => handleDragStart(event, resource)}
            className="mb-2 block cursor-grab rounded border border-gray-200 bg-gray-50 px-3 py-2 transition-colors hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-500 shadow-sm">
                {resourceIcon(resource.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-800">{resource.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600">
                    {resource.type}
                  </span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-700">
                    {resource.state}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Updated {relativeTime(resource.updated_at ?? resource.created_at)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
