'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  version: string;
  tags: string[];
  updated_at: string;
}

interface WorkflowTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  color: string;
  preview_nodes: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-yellow-100 text-yellow-700',
};

const ICON_MAP: Record<string, string> = {
  'file-text':       '📄',
  'layout-template': '🗂️',
  'zap':             '⚡',
  'settings':        '⚙️',
};

function templateIcon(icon: string): string {
  return ICON_MAP[icon] ?? '📋';
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showBlank, setShowBlank]       = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [templates, setTemplates]       = useState<WorkflowTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [form, setForm]   = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState<string | null>(null);

  // ── Load workflows ──────────────────────────────────────────────────────────

  const loadWorkflows = useCallback(() => {
    setLoading(true);
    apiClient
      .get<Workflow[]>(`/projects/${projectId}/workflows`)
      .then((res) => setWorkflows(res.data ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  // ── Load templates ──────────────────────────────────────────────────────────

  function openTemplateModal() {
    setShowTemplates(true);
    setSelectedTemplate(null);
    setError(null);
    setTemplatesLoading(true);
    apiClient
      .get<{ templates: WorkflowTemplate[] }>('/workflow-templates')
      .then((res) => setTemplates(res.data?.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }

  // ── Create blank workflow ───────────────────────────────────────────────────

  async function handleCreateBlank(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/projects/${projectId}/workflows`, form);
      setShowBlank(false);
      setForm({ name: '', description: '' });
      loadWorkflows();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setSaving(false);
    }
  }

  // ── Create from template ────────────────────────────────────────────────────

  async function handleCreateFromTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post<{ workflow: { id: string } }>(
        `/workflow-templates/${selectedTemplate.id}/instantiate`,
        { projectId, name: form.name || undefined },
      );
      setShowTemplates(false);
      setForm({ name: '', description: '' });
      const wfId = res.data?.workflow?.id;
      if (wfId) {
        router.push(`/projects/${projectId}/workflows/${wfId}`);
      } else {
        loadWorkflows();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow from template');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/projects" className="hover:text-gray-600">Projects</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Workflows</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="mt-1 text-sm text-gray-500 font-mono">{projectId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openTemplateModal}
              className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5"
            >
              <span>🗂️</span> From Template
            </button>
            <button
              onClick={() => { setShowBlank(true); setError(null); }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Workflow
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-sm text-gray-400 text-center py-16">Loading…</p>
        )}

        {/* Empty */}
        {!loading && workflows.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="text-4xl mb-3">🗂️</div>
            <p className="text-gray-700 text-sm font-semibold">No workflows yet</p>
            <p className="text-gray-400 text-xs mt-1 mb-5">
              Start from a template for the fastest path to your first run
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={openTemplateModal}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                🗂️ From Template
              </button>
              <button
                onClick={() => { setShowBlank(true); setError(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                + Blank Workflow
              </button>
            </div>
          </div>
        )}

        {/* Workflow list */}
        <div className="space-y-3">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={`/projects/${projectId}/workflows/${wf.id}`}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                    {wf.name}
                  </h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[wf.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {wf.status}
                  </span>
                </div>
                {wf.description && (
                  <p className="text-xs text-gray-500 truncate">{wf.description}</p>
                )}
                {wf.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {wf.tags.map((tag) => (
                      <span key={tag} className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                <p className="text-xs text-gray-400">v{wf.version}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(wf.updated_at).toLocaleDateString()}
                </p>
                <span className="text-xs text-blue-500 group-hover:text-blue-600 mt-1 block">
                  Open canvas →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Modal: Create Blank ─────────────────────────────────────────────── */}
      {showBlank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">New Blank Workflow</h2>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateBlank} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. BOQ to RFQ — Block A"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowBlank(false); setError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Template Picker ──────────────────────────────────────────── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Workflow Templates</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Start from a pre-built workflow — nodes are wired, ready to configure
                  </p>
                </div>
                <button
                  onClick={() => { setShowTemplates(false); setSelectedTemplate(null); setError(null); }}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >✕</button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {templatesLoading && (
                <p className="text-sm text-gray-400 text-center py-8">Loading templates…</p>
              )}

              {!templatesLoading && templates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">
                  No templates available. Run migration 0010 in Supabase SQL Editor.
                </p>
              )}

              {/* Template Cards */}
              {!templatesLoading && !selectedTemplate && (
                <div className="space-y-3">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setForm({ name: `${tpl.name}`, description: '' });
                        setError(null);
                      }}
                      className="w-full text-left rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all p-4 group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: tpl.color + '20' }}
                        >
                          {templateIcon(tpl.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                              {tpl.name}
                            </h3>
                            <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                              {tpl.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                          {/* Node flow preview */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {tpl.preview_nodes.map((n, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                                  {n}
                                </span>
                                {i < tpl.preview_nodes.length - 1 && (
                                  <span className="text-gray-300 text-[10px]">→</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-blue-400 group-hover:text-blue-600 text-sm flex-shrink-0">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Name + Confirm step */}
              {!templatesLoading && selectedTemplate && (
                <div>
                  <button
                    onClick={() => { setSelectedTemplate(null); setError(null); }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4"
                  >
                    ← Back to templates
                  </button>

                  {/* Selected template summary */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{templateIcon(selectedTemplate.icon)}</span>
                      <h3 className="text-sm font-semibold text-blue-900">{selectedTemplate.name}</h3>
                    </div>
                    <p className="text-xs text-blue-700">{selectedTemplate.description}</p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {selectedTemplate.preview_nodes.map((n, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-[10px] bg-white text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                            {n}
                          </span>
                          {i < selectedTemplate.preview_nodes.length - 1 && (
                            <span className="text-blue-300 text-[10px]">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCreateFromTemplate} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Workflow Name
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={`${selectedTemplate.name}`}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">Leave blank to use the template name</p>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowTemplates(false); setSelectedTemplate(null); setError(null); }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Creating…' : '🗂️ Create from Template'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
