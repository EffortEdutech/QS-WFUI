'use client';

/**
 * LibraryPanel — sidebar panel showing project document library.
 * Upload once, reference from any node via library_file_id config.
 * Sprint 8 (S8-004)
 */

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

type Category = 'boq' | 'spec' | 'drawing' | 'schedule' | 'other';

interface LibraryFile {
  id: string;
  label: string;
  category: Category;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  boq: 'BOQ',
  spec: 'Spec',
  drawing: 'Drawing',
  schedule: 'Schedule',
  other: 'Other',
};

const CATEGORY_ICONS: Record<Category, string> = {
  boq: '📊',
  spec: '📋',
  drawing: '📐',
  schedule: '🗓',
  other: '📄',
};

const CATEGORY_COLORS: Record<Category, string> = {
  boq:      'bg-blue-50 text-blue-700 border-blue-200',
  spec:     'bg-purple-50 text-purple-700 border-purple-200',
  drawing:  'bg-orange-50 text-orange-700 border-orange-200',
  schedule: 'bg-green-50 text-green-700 border-green-200',
  other:    'bg-gray-50 text-gray-600 border-gray-200',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  organizationId: string;
  projectId: string;
}

export default function LibraryPanel({ organizationId, projectId }: Props) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingCategory, setPendingCategory] = useState<Category>('other');

  const loadFiles = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ organizationId, projectId });
      const res = await apiClient.get<LibraryFile[]>(`/library?${params}`);
      setFiles(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [organizationId, projectId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Auto-fill label from filename (strip extension)
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    setPendingLabel(baseName);
    // Auto-detect category from name
    const lower = file.name.toLowerCase();
    if (lower.includes('boq') || lower.includes('bill')) setPendingCategory('boq');
    else if (lower.includes('spec')) setPendingCategory('spec');
    else if (lower.includes('draw') || lower.includes('dwg')) setPendingCategory('drawing');
    else if (lower.includes('sched')) setPendingCategory('schedule');
    else setPendingCategory('other');
    setPendingFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!pendingFile || !pendingLabel.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const params = new URLSearchParams({
        organizationId,
        projectId,
        label: pendingLabel.trim(),
        category: pendingCategory,
      });
      const json = await apiClient.postForm<unknown>(`/library?${params}`, formData) as { success: boolean; error?: { message: string } };
      if (!json.success) {
        setUploadError(json.error?.message ?? 'Upload failed');
        return;
      }
      // Reset and reload
      setPendingFile(null);
      setPendingLabel('');
      setPendingCategory('other');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    setDeleteError(null);
    try {
      const res = await apiClient.delete<unknown>(`/library/${fileId}`) as { success: boolean; error?: { message: string } };
      if (!res.success) {
        setDeleteError(res.error?.message ?? 'Delete failed');
        return;
      }
      setConfirmDeleteId(null);
      await loadFiles();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filtered = filterCategory === 'all'
    ? files
    : files.filter((f) => f.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce<Record<string, LibraryFile[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full text-xs">
      {/* ── Upload form ── */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          id="library-file-input"
        />

        {!pendingFile ? (
          <label
            htmlFor="library-file-input"
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors"
          >
            <span>⬆</span>
            <span>Upload to library</span>
          </label>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-gray-700 bg-white border border-gray-200 rounded px-2 py-1">
              <span>📎</span>
              <span className="truncate flex-1">{pendingFile.name}</span>
              <button
                onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >✕</button>
            </div>
            <input
              type="text"
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              placeholder="Label (e.g. Hospital B BOQ v3)"
              className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={pendingCategory}
              onChange={(e) => setPendingCategory(e.target.value as Category)}
              className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            {uploadError && <p className="text-red-500 text-[10px]">{uploadError}</p>}
            <button
              onClick={() => void handleUpload()}
              disabled={uploading || !pendingLabel.trim()}
              className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading…' : 'Add to Library'}
            </button>
          </div>
        )}
      </div>

      {/* ── Category filter ── */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-gray-100 overflow-x-auto flex-shrink-0">
        {(['all', ...Object.keys(CATEGORY_LABELS)] as (Category | 'all')[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
              filterCategory === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as Category]}
          </button>
        ))}
      </div>

      {/* ── File list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-gray-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-1 text-gray-400 px-3 text-center">
            <span className="text-2xl">📂</span>
            <span>No documents yet</span>
            <span className="text-[10px]">Upload a BOQ, spec, or drawing to get started</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-gray-400">
            No {filterCategory} files
          </div>
        ) : (
          Object.entries(grouped).map(([category, catFiles]) => (
            <div key={category}>
              <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <span>{CATEGORY_ICONS[category as Category]}</span>
                <span>{CATEGORY_LABELS[category as Category]}</span>
                <span className="ml-auto text-gray-400">{catFiles.length}</span>
              </div>
              {catFiles.map((file) => (
                <div
                  key={file.id}
                  className="px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  {confirmDeleteId === file.id ? (
                    /* Inline confirm */
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-700 font-medium">Remove "{file.label}"?</p>
                      <p className="text-[10px] text-gray-400">This cannot be undone.</p>
                      {deleteError && <p className="text-[10px] text-red-500">{deleteError}</p>}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => void handleDelete(file.id)}
                          className="flex-1 py-1 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                          className="flex-1 py-1 rounded border border-gray-200 text-gray-600 text-[10px] hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate leading-tight">{file.label}</p>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{file.original_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${CATEGORY_COLORS[file.category]}`}>
                            {CATEGORY_LABELS[file.category]}
                          </span>
                          <span className="text-[10px] text-gray-400">{formatBytes(file.size_bytes)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDeleteId(file.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5 px-1"
                        title="Remove from library"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
