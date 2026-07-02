'use client';

import { useState, useEffect } from 'react';
import { FieldWrapper } from './FieldWrapper';
import { apiClient } from '@/lib/api/client';
import type { FieldProps } from './types';

interface ResourceRecord {
  id:    string;
  name:  string;
  type:  string;
  state: string;
}

export default function ResourcePickerField({ field, value, onChange, organizationId }: FieldProps) {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const resourceId = (value as string) ?? '';

  // Resolve resource type from either ui:resourceType or legacy resourceType
  const resourceType = field['ui:resourceType'] ?? field.resourceType ?? field.ui?.resourceType;

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    const params = new URLSearchParams({ organizationId });
    if (resourceType) params.set('type', resourceType);
    apiClient
      .get<ResourceRecord[]>(`/resources?${params}`)
      .then((res) => setResources(res.data ?? []))
      .finally(() => setLoading(false));
  }, [organizationId, resourceType]);

  const selected = resources.find((r) => r.id === resourceId);

  return (
    <FieldWrapper field={field}>
      <select
        value={resourceId}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={loading}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white disabled:opacity-50"
      >
        <option value="">{loading ? 'Loading resources…' : '— Select resource —'}</option>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.state})
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-[10px] text-gray-400 truncate mt-0.5">
          id: <span className="font-mono">{selected.id.slice(0, 8)}…</span>
          {' · '}{selected.type}
        </p>
      )}
      {resources.length === 0 && !loading && (
        <p className="text-[10px] text-amber-500 mt-0.5">
          No {resourceType ? `${resourceType} ` : ''}resources found
        </p>
      )}
    </FieldWrapper>
  );
}
