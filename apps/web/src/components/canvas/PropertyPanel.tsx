'use client';

/**
 * PropertyPanel — shown on the right when a node is selected on the canvas.
 * Dynamically renders config fields from the node's config_schema.
 *
 * Sprint 5 (S5-007).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type { Node } from 'reactflow';

interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'file' | 'json' | 'secret' | 'library-picker';
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

interface NodeDefinition {
  type: string;
  name: string;
  description?: string;
  category: string;
  color?: string;
  config_schema: ConfigField[];
  packs?: { display_name: string };
}

// ── File Upload inline component ─────────────────────────────────────────────

function FileUploadField({
  value,
  onChange,
  organizationId,
  projectId,
}: {
  value: string;
  onChange: (fileId: string) => void;
  organizationId?: string;
  projectId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      onChange(json.data.fileId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [organizationId, projectId, onChange]);

  return (
    <div className="space-y-1">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      {value && fileName ? (
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          <span>✓</span>
          <span className="truncate flex-1">{fileName}</span>
          <button onClick={() => { onChange(''); setFileName(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-green-400 hover:text-green-600">✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-full py-1.5 px-2 rounded border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading…' : '⬆ Choose file to upload'}
        </button>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {value && !fileName && (
        <p className="text-[10px] text-gray-400 font-mono truncate">id: {value}</p>
      )}
    </div>
  );
}

// ── Library Picker inline component ──────────────────────────────────────────

interface LibraryEntry {
  id: string;
  label: string;
  category: string;
  original_name: string;
}

function LibraryPickerField({
  value,
  onChange,
  organizationId,
  projectId,
}: {
  value: string;
  onChange: (id: string) => void;
  organizationId?: string;
  projectId?: string;
}) {
  const [files, setFiles] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  const selected = files.find((f) => f.id === value);

  return (
    <div className="space-y-1">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white disabled:opacity-50"
      >
        <option value="">{loading ? 'Loading library…' : '— Pick from library —'}</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label} ({f.category})
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-[10px] text-gray-400 truncate">{selected.original_name}</p>
      )}
      {files.length === 0 && !loading && (
        <p className="text-[10px] text-amber-500">
          No library files yet — use the Documents tab to upload
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PropertyPanelProps {
  selectedNode: Node | null;
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  onDeleteNode?: (nodeId: string) => void;
  organizationId?: string;
  projectId?: string;
}

export default function PropertyPanel({
  selectedNode,
  onConfigChange,
  onDeleteNode,
  organizationId,
  projectId,
}: PropertyPanelProps) {
  const [nodeDef, setNodeDef] = useState<NodeDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNode) {
      setNodeDef(null);
      setConfig({});
      return;
    }

    const nodeType = selectedNode.data?.nodeType as string | undefined;
    if (!nodeType) return;

    setLoading(true);
    apiClient
      .get<NodeDefinition>(`/nodes/${encodeURIComponent(nodeType)}`)
      .then((res) => {
        setNodeDef(res.data ?? null);
        // Seed config with existing data from node, falling back to defaults
        const existing = (selectedNode.data?.config ?? {}) as Record<string, unknown>;
        const defaults: Record<string, unknown> = {};
        for (const field of res.data?.config_schema ?? []) {
          defaults[field.key] = existing[field.key] ?? field.defaultValue ?? '';
        }
        setConfig(defaults);
      })
      .catch(() => setNodeDef(null))
      .finally(() => setLoading(false));
  }, [selectedNode?.id, selectedNode?.data?.nodeType]);

  const handleChange = (key: string, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (selectedNode) {
      onConfigChange(selectedNode.id, next);
    }
  };

  if (!selectedNode) {
    return (
      <aside className="w-64 flex-shrink-0 border-l border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-400 text-center mt-8">
          Select a node to configure it
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col overflow-hidden border-l border-gray-200 bg-white">
      {/* Header */}
      <div
        className="p-4 border-b border-gray-100"
        style={{ borderTop: `3px solid ${nodeDef?.color ?? '#6B7280'}` }}
      >
        <p className="text-xs text-gray-400 mb-0.5">
          {nodeDef?.packs?.display_name ?? '—'} Pack
        </p>
        <h3 className="font-semibold text-gray-900 text-sm">
          {nodeDef?.name ?? selectedNode.data?.label ?? 'Node'}
        </h3>
        {nodeDef?.description && (
          <p className="mt-1 text-xs text-gray-500">{nodeDef.description}</p>
        )}
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
        )}

        {!loading && nodeDef && nodeDef.config_schema.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            This node has no configuration.
          </p>
        )}

        {!loading &&
          nodeDef?.config_schema.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {field.description && (
                <p className="text-[11px] text-gray-400 mb-1">{field.description}</p>
              )}

              {/* Text / secret */}
              {(field.type === 'string' || field.type === 'secret') && (
                <input
                  type={field.type === 'secret' ? 'password' : 'text'}
                  value={(config[field.key] as string) ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
                />
              )}

              {/* File upload — calls POST /uploads and stores the returned file_id */}
              {field.type === 'file' && (
                <FileUploadField
                  value={(config[field.key] as string) ?? ''}
                  onChange={(fileId) => handleChange(field.key, fileId)}
                  organizationId={organizationId}
                  projectId={projectId}
                />
              )}

              {/* Number */}
              {field.type === 'number' && (
                <input
                  type="number"
                  value={(config[field.key] as number) ?? ''}
                  onChange={(e) => handleChange(field.key, Number(e.target.value))}
                  placeholder={field.placeholder}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
                />
              )}

              {/* Boolean */}
              {field.type === 'boolean' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config[field.key])}
                    onChange={(e) => handleChange(field.key, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs text-gray-600">Enabled</span>
                </label>
              )}

              {/* Select */}
              {field.type === 'select' && (
                <select
                  value={(config[field.key] as string) ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white"
                >
                  <option value="">— Select —</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Textarea / JSON */}
              {(field.type === 'textarea' || field.type === 'json') && (
                <textarea
                  value={(config[field.key] as string) ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.type === 'json' ? 4 : 3}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none font-mono resize-none"
                />
              )}

              {/* Library picker — ComfyUI-style file selector from project library */}
              {field.type === 'library-picker' && (
                <LibraryPickerField
                  value={(config[field.key] as string) ?? ''}
                  onChange={(id) => handleChange(field.key, id)}
                  organizationId={organizationId}
                  projectId={projectId}
                />
              )}
            </div>
          ))}
      </div>

      {/* Footer — node type + delete */}
      <div className="p-3 border-t border-gray-100 flex items-center gap-2">
        <p className="text-[10px] font-mono text-gray-400 truncate flex-1">
          {selectedNode.data?.nodeType ?? '—'}
        </p>
        {onDeleteNode && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="flex-shrink-0 text-[10px] text-gray-300 hover:text-red-500 hover:bg-red-50 rounded px-1.5 py-0.5 transition-colors"
            title="Delete node (Del)"
          >
            🗑 Remove
          </button>
        )}
      </div>
    </aside>
  );
}
