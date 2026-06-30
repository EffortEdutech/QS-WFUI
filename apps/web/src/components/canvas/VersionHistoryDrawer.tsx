'use client';

/**
 * VersionHistoryDrawer — slides in from the right to show workflow version history.
 *
 * Features:
 *  - List of all snapshots (version number, label, date)
 *  - "Save Version" button to snapshot the current definition
 *  - "Restore" button on each entry (with inline confirm)
 *
 * Sprint 18 (S18-002)
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface WorkflowVersion {
  id: string;
  version_number: number;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

interface VersionHistoryDrawerProps {
  projectId:  string;
  workflowId: string;
  onClose:    () => void;
  /** Called after a successful restore so the page can reload the definition */
  onRestored: () => void;
}

export default function VersionHistoryDrawer({
  projectId,
  workflowId,
  onClose,
  onRestored,
}: VersionHistoryDrawerProps) {
  const [versions, setVersions]         = useState<WorkflowVersion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [restoring, setRestoring]       = useState(false);
  const [labelInput, setLabelInput]     = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get<WorkflowVersion[]>(`/projects/${projectId}/workflows/${workflowId}/versions`)
      .then((res) => setVersions(res.data ?? []))
      .catch(() => setError('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [projectId, workflowId]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveVersion() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(
        `/projects/${projectId}/workflows/${workflowId}/versions`,
        { label: labelInput.trim() || undefined },
      );
      setLabelInput('');
      setShowLabelInput(false);
      load();
    } catch {
      setError('Failed to save version');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(versionId: string) {
    setRestoring(true);
    setError(null);
    try {
      await apiClient.post(
        `/projects/${projectId}/workflows/${workflowId}/versions/${versionId}/restore`,
        {},
      );
      setConfirmId(null);
      onRestored();
      onClose();
    } catch {
      setError('Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-MY', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white border-l border-gray-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {versions.length} snapshot{versions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Save version section */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          {showLabelInput ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Version label (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveVersion(); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSaveVersion()}
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Snapshot'}
                </button>
                <button
                  onClick={() => { setShowLabelInput(false); setLabelInput(''); }}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLabelInput(true)}
              className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>📸</span> Save Current Version
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-1.5">
            <span>⚠</span>{error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Version list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-xs text-gray-400 animate-pulse">Loading…</p>
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="text-4xl mb-3">🕐</div>
              <p className="text-xs font-medium text-gray-600 mb-1">No versions yet</p>
              <p className="text-[10px] text-gray-400">
                Click &ldquo;Save Current Version&rdquo; to create your first snapshot.
              </p>
            </div>
          )}

          {!loading && versions.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {versions.map((v) => (
                <li key={v.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-2">
                    {/* Version badge */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-600">
                      v{v.version_number}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {v.label ?? `Version ${v.version_number}`}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatDate(v.created_at)}
                      </p>

                      {confirmId === v.id ? (
                        <div className="mt-2 flex gap-1.5">
                          <button
                            onClick={() => void handleRestore(v.id)}
                            disabled={restoring}
                            className="px-2 py-1 bg-red-600 text-white text-[10px] font-medium rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {restoring ? 'Restoring…' : 'Confirm Restore'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 border border-gray-300 text-gray-600 text-[10px] rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(v.id)}
                          className="mt-1.5 text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                        >
                          ↩ Restore this version
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer note */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Restoring auto-saves the current state first, so you can always undo a restore.
          </p>
        </div>
      </div>
       </>
  );
}
