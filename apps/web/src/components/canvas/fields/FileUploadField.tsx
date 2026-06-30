'use client';

import { useState, useRef, useCallback } from 'react';
import { FieldWrapper } from './FieldWrapper';
import { apiClient } from '@/lib/api/client';
import type { FieldProps } from './types';

export default function FileUploadField({ field, value, onChange, organizationId, projectId }: FieldProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileId = (value as string) ?? '';

  const handleFile = useCallback(async (file: File) => {
    if (!organizationId) { setError('No organization context'); return; }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.set('projectId', projectId);
      const json = await apiClient.postForm<{ fileId: string }>(`/uploads?${params}`, formData);
      if (!json.success || !json.data) { setError(json.error?.message ?? 'Upload failed'); return; }
      setFileName(file.name);
      onChange(field.key, json.data.fileId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [field.key, organizationId, projectId, onChange]);

  const clear = () => {
    onChange(field.key, '');
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <FieldWrapper field={field}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        data-testid={`field-${field.key}`}
      />
      {fileId && fileName ? (
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          <span>✓</span>
          <span className="truncate flex-1">{fileName}</span>
          <button type="button" onClick={clear} className="text-green-400 hover:text-green-600">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-1.5 px-2 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : '⬆ Choose file to upload'}
        </button>
      )}
      {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
      {fileId && !fileName && (
        <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">id: {fileId}</p>
      )}
    </FieldWrapper>
  );
}
