'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { NodeInstanceId, QSWorkflowDefinition, WorkflowConnection } from '@lados/shared-types';

const WorkflowCanvas = dynamic(() => import('@/components/canvas/WorkflowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-gray-400">
      Loading preview...
    </div>
  ),
});

interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  icon: string | null;
  color: string | null;
  preview_nodes: string[] | null;
}

interface TemplateDetail extends TemplateSummary {
  definition: QSWorkflowDefinition;
}

interface TemplateListResponse {
  templates: TemplateSummary[];
}

interface ExplorerTemplatesTabProps {
  projectId: string;
  workflowId: string;
  organizationId: string;
  search: string;
  readOnly?: boolean;
  onApplyTemplate: (definition: QSWorkflowDefinition) => void;
}

function normalizeDefinition(raw: unknown, name: string): QSWorkflowDefinition {
  const def = raw as QSWorkflowDefinition & {
    edges?: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
  };

  const connections: WorkflowConnection[] = def.connections?.length
    ? def.connections
    : (def.edges ?? []).map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source as NodeInstanceId,
        sourcePortId: edge.sourceHandle ?? 'out',
        targetNodeId: edge.target as NodeInstanceId,
        targetPortId: edge.targetHandle ?? 'in',
      })) as WorkflowConnection[];

  return {
    ...def,
    schemaVersion: def.schemaVersion ?? '1.0',
    workflow: def.workflow ?? {
      id: '' as NodeInstanceId,
      name,
      version: '1.0.0',
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    nodes: def.nodes ?? [],
    connections,
  };
}

export default function ExplorerTemplatesTab({
  projectId,
  workflowId,
  organizationId,
  search,
  readOnly = false,
  onApplyTemplate,
}: ExplorerTemplatesTabProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [preview, setPreview] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<TemplateListResponse>('/workflow-templates')
      .then((res) => {
        if (!res.success) {
          setError(res.error?.message ?? 'Failed to load templates');
          return;
        }
        setTemplates(res.data?.templates ?? []);
      })
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(templates.map((tpl) => tpl.category ?? 'General'))).sort(),
    [templates],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      const category = template.category ?? 'General';
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch =
        !term ||
        template.name.toLowerCase().includes(term) ||
        (template.description ?? '').toLowerCase().includes(term) ||
        (template.tags ?? []).some((tag) => tag.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search, templates]);

  const loadTemplate = async (template: TemplateSummary): Promise<TemplateDetail | null> => {
    setLoadingTemplateId(template.id);
    try {
      const res = await apiClient.get<TemplateDetail>(`/workflow-templates/${encodeURIComponent(template.id)}`);
      if (!res.success || !res.data) {
        setError(res.error?.message ?? 'Failed to load template');
        return null;
      }
      return {
        ...res.data,
        definition: normalizeDefinition(res.data.definition, res.data.name),
      };
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const handlePreview = async (template: TemplateSummary) => {
    const detail = await loadTemplate(template);
    if (detail) setPreview(detail);
  };

  const handleApply = async (template: TemplateSummary) => {
    if (readOnly) return;
    const ok = window.confirm('This will replace the current canvas with the selected template. Continue?');
    if (!ok) return;
    const detail = await loadTemplate(template);
    if (!detail) return;
    onApplyTemplate(detail.definition);
  };

  return (
    <div className="flex h-full flex-col bg-white text-xs">
      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${
            activeCategory === 'all' ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`flex-shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${
              activeCategory === category ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="py-6 text-center text-xs text-gray-400">Loading templates...</p>}
        {error && <p className="py-6 text-center text-xs text-red-500">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">No templates found</p>
        )}

        {!loading && !error && filtered.map((template) => {
          const busy = loadingTemplateId === template.id;
          return (
            <div key={template.id} className="mb-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: template.color ?? '#2563eb' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">{template.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-400">
                    {template.description ?? 'Workflow template'}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {(template.preview_nodes ?? []).length} preview nodes
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handlePreview(template)}
                  disabled={busy}
                  className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                >
                  {busy ? 'Loading...' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleApply(template)}
                  disabled={busy || readOnly}
                  className="flex-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  Apply
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="flex h-[80vh] w-[min(960px,92vw)] flex-col rounded-lg bg-white shadow-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{preview.name}</h2>
                <p className="text-[10px] text-gray-400">
                  {preview.definition.nodes?.length ?? 0} skills · read-only preview
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                x
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <WorkflowCanvas
                definition={preview.definition}
                readOnly
                organizationId={organizationId}
                projectId={projectId}
                workflowId={workflowId}
              />
            </div>
            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!readOnly && window.confirm('Replace the current canvas with this template?')) {
                    onApplyTemplate(preview.definition);
                    setPreview(null);
                  }
                }}
                disabled={readOnly}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
              >
                Apply to Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
