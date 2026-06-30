'use client';

import { useState, useEffect } from 'react';
import { FieldWrapper } from './FieldWrapper';
import { apiClient } from '@/lib/api/client';
import type { FieldProps } from './types';

interface LibraryEntry {
  id: string;
  label: string;
  category: string;
  original_name: string;
}

export default function LibraryPickerField({ field, value, onChange, organizationId, projectId }: FieldProps) {
  const [files, setFiles] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const fileId = (value as string) ?? '';

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    const params = new URLSearchParams({ organizationId });
    if (projectId) params.set('projectId', projectId);
    apiClient
      .get<LibraryEntry[]>(`/library?${params}`)
      .then((res) => setFiles(res.data ?? []))
      .finally(() => setLoading(false));
  }, [organizationId, projectId]);

  const selected = files.find((f) => f.id === fileId);

  return (
    <FieldWrapper field={field}>
      <select
        value={fileId}
        onChange={(e) => onChange(field.key, e.target.value)}
        disabled={loading}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white disabled:opacity-50"
      >
        <option value="">{loading ? 'Loading library…' : '— Pick from library —'}</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>{f.label} ({f.category})</option>
        ))}
      </select>
      {selected && (
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{selected.original_name}</p>
      )}
      {files.length === 0 && !loading && (
        <p className="text-[10px] text-amber-500 mt-0.5">
          No library files yet — use the Documents tab to upload
        </p>
      )}
    </FieldWrapper>
  );
}
