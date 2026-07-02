'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ResourceBinding } from '@lados/shared-types';
import type { ConfigField } from './fields';

interface ResourceRecord {
  id: string;
  name: string;
  type: string;
  state?: string;
}

interface ResourceBindingPanelProps {
  workflowId?: string;
  nodeId: string;
  fields: ConfigField[];
  organizationId?: string;
}

function getResourceType(field: ConfigField): string {
  return field['ui:resourceType'] ?? field.resourceType ?? field.ui?.resourceType ?? '';
}

function isBindableField(field: ConfigField): boolean {
  const widget = field['ui:widget'] ?? field.ui?.widget;
  return field.type === 'resource' || widget === 'resource-picker' || Boolean(getResourceType(field));
}

export default function ResourceBindingPanel({
  workflowId,
  nodeId,
  fields,
  organizationId,
}: ResourceBindingPanelProps) {
  const bindableFields = useMemo(() => fields.filter(isBindableField), [fields]);
  const [bindings, setBindings] = useState<ResourceBinding[]>([]);
  const [resourcesByType, setResourcesByType] = useState<Record<string, ResourceRecord[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId || bindableFields.length === 0) {
      setBindings([]);
      return;
    }

    setLoading(true);
    setError(null);
    apiClient
      .get<ResourceBinding[]>(`/workflows/${workflowId}/bindings`)
      .then((res) => {
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to load bindings');
          return;
        }
        setBindings((res.data ?? []).filter((binding) => binding.nodeId === nodeId));
      })
      .finally(() => setLoading(false));
  }, [workflowId, nodeId, bindableFields.length]);

  useEffect(() => {
    if (!organizationId || bindableFields.length === 0) return;

    const resourceTypes = Array.from(
      new Set(bindableFields.map(getResourceType).filter((type) => type.length > 0)),
    );

    for (const resourceType of resourceTypes) {
      if (resourcesByType[resourceType]) continue;

      const params = new URLSearchParams({ organizationId, type: resourceType });
      apiClient.get<ResourceRecord[]>(`/resources?${params}`).then((res) => {
        if (!res.success) return;
        setResourcesByType((current) => ({
          ...current,
          [resourceType]: res.data ?? [],
        }));
      });
    }
  }, [bindableFields, organizationId, resourcesByType]);

  const bindingByKey = useMemo(() => {
    return new Map(bindings.map((binding) => [binding.bindingKey, binding]));
  }, [bindings]);

  const upsertBinding = async (field: ConfigField, resourceId: string) => {
    if (!workflowId || !resourceId) return;

    const resourceType = getResourceType(field);
    setSavingKey(field.key);
    setError(null);

    const res = await apiClient.put<ResourceBinding>(
      `/workflows/${workflowId}/bindings/${encodeURIComponent(nodeId)}/${encodeURIComponent(field.key)}`,
      { resourceId, resourceType },
    );

    const savedBinding = res.data;
    if (!res.success || !savedBinding) {
      setError(res.error?.message ?? 'Failed to save binding');
      setSavingKey(null);
      return;
    }

    setBindings((current) => [
      ...current.filter((binding) => binding.bindingKey !== field.key),
      savedBinding,
    ]);
    setSavingKey(null);
  };

  const removeBinding = async (field: ConfigField) => {
    if (!workflowId) return;

    setSavingKey(field.key);
    setError(null);
    const res = await apiClient.delete<null>(
      `/workflows/${workflowId}/bindings/${encodeURIComponent(nodeId)}/${encodeURIComponent(field.key)}`,
    );

    if (!res.success) {
      setError(res.error?.message ?? 'Failed to remove binding');
      setSavingKey(null);
      return;
    }

    setBindings((current) => current.filter((binding) => binding.bindingKey !== field.key));
    setSavingKey(null);
  };

  if (bindableFields.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-gray-400">
        This skill has no bindable resource fields.
      </p>
    );
  }

  if (!workflowId) {
    return (
      <p className="py-4 text-center text-xs text-amber-600">
        Save or open this workflow before creating resource bindings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-800">Resource Bindings</p>
        <p className="mt-0.5 text-[10px] leading-snug text-gray-400">
          Bind this skill to Workspace Resources without storing raw resource IDs in node config.
        </p>
      </div>

      {loading && <p className="text-xs text-gray-400">Loading bindings...</p>}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-600">
          {error}
        </div>
      )}

      {bindableFields.map((field) => {
        const resourceType = getResourceType(field);
        const resources = resourcesByType[resourceType] ?? [];
        const binding = bindingByKey.get(field.key);
        const selectedId = binding?.resourceId ?? '';
        const selected = resources.find((resource) => resource.id === selectedId);
        const isSaving = savingKey === field.key;

        return (
          <div key={field.key} className="rounded border border-gray-200 bg-white p-2">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-800">{field.label}</p>
                <p className="truncate font-mono text-[10px] text-gray-400">
                  {field.key} {resourceType ? `* ${resourceType}` : ''}
                </p>
              </div>
              {binding && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  Bound
                </span>
              )}
            </div>

            <select
              value={selectedId}
              onChange={(event) => void upsertBinding(field, event.target.value)}
              disabled={isSaving || !organizationId}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {organizationId ? 'Select resource binding' : 'Organization unavailable'}
              </option>
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}{resource.state ? ` (${resource.state})` : ''}
                </option>
              ))}
            </select>

            <div className="mt-1.5 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[10px] text-gray-400">
                {selected
                  ? `Resolved at run time to ${selected.name}`
                  : resourceType
                    ? `No ${resourceType} binding selected`
                    : 'No resource type declared'}
              </p>
              {binding && (
                <button
                  type="button"
                  onClick={() => void removeBinding(field)}
                  disabled={isSaving}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
