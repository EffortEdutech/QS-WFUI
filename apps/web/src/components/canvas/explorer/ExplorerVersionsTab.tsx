'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface WorkflowVersion {
  id: string;
  version_number: number;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

interface ExplorerVersionsTabProps {
  projectId: string;
  workflowId: string;
  search: string;
  onRestored: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ExplorerVersionsTab({
  projectId,
  workflowId,
  search,
  onRestored,
}: ExplorerVersionsTabProps) {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<WorkflowVersion[]>(`/projects/${projectId}/workflows/${workflowId}/versions`)
      .then((res) => {
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to load versions');
          return;
        }
        setVersions(res.data ?? []);
      })
      .catch(() => setError('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [projectId, workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = versions.filter((version) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (version.label ?? '').toLowerCase().includes(term) ||
      `version ${version.version_number}`.includes(term) ||
      formatDate(version.created_at).toLowerCase().includes(term)
    );
  });

  const handleSaveVersion = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post(
        `/projects/${projectId}/workflows/${workflowId}/versions`,
        { label: labelInput.trim() || undefined },
      );
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save version');
        return;
      }
      setLabelInput('');
      setShowLabelInput(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    const ok = window.confirm('Restore this workflow version? The current state will be saved first.');
    if (!ok) return;
    setRestoringId(versionId);
    setError(null);
    try {
      const res = await apiClient.post(
        `/projects/${projectId}/workflows/${workflowId}/versions/${versionId}/restore`,
        {},
      );
      if (!res.success) {
        setError(res.error?.message ?? 'Restore failed');
        return;
      }
      onRestored();
      load();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white text-xs">
      <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50 px-3 py-2">
        {showLabelInput ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSaveVersion();
              }}
              placeholder="Snapshot label"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => void handleSaveVersion()}
                disabled={saving}
                className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLabelInput(false);
                  setLabelInput('');
                }}
                className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLabelInput(true)}
            className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-[10px] font-semibold text-gray-600 shadow-sm hover:border-blue-300 hover:text-blue-600"
          >
            Save Current Snapshot
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-600">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="py-6 text-center text-xs text-gray-400">Loading versions...</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">No versions found</p>
        )}
        {!loading && filtered.map((version) => (
          <div key={version.id} className="border-b border-gray-100 px-3 py-2.5 hover:bg-gray-50">
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
                v{version.version_number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-800">
                  {version.label ?? `Version ${version.version_number}`}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">{formatDate(version.created_at)}</p>
                <button
                  type="button"
                  onClick={() => void handleRestore(version.id)}
                  disabled={restoringId === version.id}
                  className="mt-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-700 disabled:text-gray-300"
                >
                  {restoringId === version.id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
