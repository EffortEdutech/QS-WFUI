'use client';

/**
 * PropertyPanel — "Skill Inspector" in V3 terminology.
 * Shown on the right when a node is selected on the canvas.
 *
 * Sprint 5  (S5-007): initial — config form from node config_schema.
 * Sprint 13 (S13-004): V3 enrichment — pack name, description, input/output
 *                       port list, uses_services chips, data_pack_deps chips.
 * Phase 13  (P13-004): Manifest-driven rendering — replaced hardcoded
 *                       type-switch with ManifestFieldRouter + ManifestSection.
 *                       Supports ui:widget hints, sections, and all UiWidget types.
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { PORT_COLORS, getPortLabel, getPortType } from '@/lib/portTypes';
import type { Node } from 'reactflow';

import ManifestFieldRouter from './ManifestFieldRouter';
import ManifestSection from './ManifestSection';
import ResourceBindingPanel from './ResourceBindingPanel';
import type { ConfigField } from './fields';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodePort {
  id: string;
  label?: string;
  name?: string;
  type?: string;
  dataType?: string;
  description?: string;
  required?: boolean;
}

interface ResourceRequirement {
  resourceType:  string;
  description?:  string;
  access?:       string;
}

interface UiSection {
  title: string;
  fieldKeys: string[];
}

interface NodeUISchema {
  title?: string;
  icon?: string;
  color?: string;
  sections?: UiSection[];
}

interface NodeDefinition {
  type: string;
  name: string;
  description?: string;
  category: string;
  color?: string;
  version?: string;
  config_schema: ConfigField[];
  inputs?: NodePort[];
  outputs?: NodePort[];
  uses_services?: string[];
  data_pack_deps?: string[];
  packs?: { display_name: string; color?: string };
  resource_requirements?: ResourceRequirement[];
  /** V2 manifest ui_schema — may be present when API serialises uiSchema as ui_schema */
  ui_schema?: NodeUISchema;
}

// ── Service chip helpers ──────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, string> = {
  'ai-service':           '🤖',
  'storage-service':      '💾',
  'audit-service':        '📋',
  'auth-service':         '🔐',
  'ocr-service':          '🔍',
  'document-service':     '📄',
  'notification-service': '🔔',
};

const SERVICE_LABELS: Record<string, string> = {
  'ai-service':           'AI Service',
  'storage-service':      'Storage',
  'audit-service':        'Audit',
  'auth-service':         'Auth',
  'ocr-service':          'OCR',
  'document-service':     'Document',
  'notification-service': 'Notifications',
};

function ServiceChip({ svc }: { svc: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
      {SERVICE_ICONS[svc] ?? '⚙'} {SERVICE_LABELS[svc] ?? svc}
    </span>
  );
}

function DataPackChip({ slug }: { slug: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
      📦 {slug}
    </span>
  );
}

// ── Config field rendering helpers ────────────────────────────────────────────

/**
 * Renders config fields using ManifestSection when ui_schema.sections are
 * declared, otherwise renders flat using ManifestFieldRouter.
 */
function PortListItem({ port }: { port: NodePort }) {
  const portType = getPortType(port) ?? 'any';

  return (
    <li className="flex items-center gap-1.5 text-[10px] text-gray-600">
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: PORT_COLORS[portType] }}
      />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">
        {getPortLabel(port)}
      </span>
      <span className="flex-shrink-0 font-mono text-[9px] text-gray-400">{portType}</span>
    </li>
  );
}

function ConfigFields({
  nodeDef,
  config,
  onChange,
  organizationId,
  projectId,
}: {
  nodeDef: NodeDefinition;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  organizationId?: string;
  projectId?: string;
}) {
  const fields = nodeDef.config_schema;
  const sections = nodeDef.ui_schema?.sections ?? [];

  if (fields.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">
        This skill has no configuration.
      </p>
    );
  }

  // ── Sectioned rendering ─────────────────────────────────────────────────
  if (sections.length > 0) {
    // Build a Set of field keys that are assigned to any section
    const assignedKeys = new Set(sections.flatMap((s) => s.fieldKeys));
    const unsectionedFields = fields.filter((f) => !assignedKeys.has(f.key));

    return (
      <div className="space-y-2">
        {sections.map((section, i) => {
          const sectionFields = section.fieldKeys
            .map((k) => fields.find((f) => f.key === k))
            .filter((f): f is ConfigField => f !== undefined);

          return (
            <ManifestSection
              key={section.title}
              title={section.title}
              fields={sectionFields}
              config={config}
              onChange={onChange}
              organizationId={organizationId}
              projectId={projectId}
              defaultOpen={i === 0}
            />
          );
        })}

        {/* Fields not assigned to any section */}
        {unsectionedFields.length > 0 && (
          <ManifestSection
            title="Other"
            fields={unsectionedFields}
            config={config}
            onChange={onChange}
            organizationId={organizationId}
            projectId={projectId}
            defaultOpen
          />
        )}
      </div>
    );
  }

  // ── Flat rendering (no sections) ────────────────────────────────────────
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <ManifestFieldRouter
          key={field.key}
          field={field}
          value={config[field.key]}
          onChange={onChange}
          organizationId={organizationId}
          projectId={projectId}
        />
      ))}
    </div>
  );
}

// ── PropertyPanel ─────────────────────────────────────────────────────────────

interface PropertyPanelProps {
  selectedNode: Node | null;
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  onLabelChange?: (nodeId: string, label: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  organizationId?: string;
  projectId?: string;
  workflowId?: string;
}

export default function PropertyPanel({
  selectedNode,
  onConfigChange,
  onLabelChange,
  onDeleteNode,
  organizationId,
  projectId,
  workflowId,
}: PropertyPanelProps) {
  const [nodeDef, setNodeDef] = useState<NodeDefinition | null>(null);
  const [config,  setConfig]  = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'bindings'>('config');

  useEffect(() => {
    if (!selectedNode) {
      setNodeDef(null);
      setConfig({});
      setLabelValue('');
      setActiveTab('config');
      return;
    }

    setLabelValue((selectedNode.data?.label as string) ?? '');
    setActiveTab('config');

    const nodeType = selectedNode.data?.nodeType as string | undefined;
    if (!nodeType) return;

    setLoading(true);
    apiClient
      .get<NodeDefinition>(`/nodes/${encodeURIComponent(nodeType)}`)
      .then((res) => {
        setNodeDef(res.data ?? null);
        // Seed config from existing node data, filling gaps with field defaults
        const existing = (selectedNode.data?.config ?? {}) as Record<string, unknown>;
        const seeded: Record<string, unknown> = {};
        for (const field of res.data?.config_schema ?? []) {
          seeded[field.key] = existing[field.key] ?? field.defaultValue ?? '';
        }
        setConfig(seeded);
      })
      .catch(() => setNodeDef(null))
      .finally(() => setLoading(false));
  }, [selectedNode?.id, selectedNode?.data?.nodeType]);

  const handleChange = (key: string, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    if (selectedNode) onConfigChange(selectedNode.id, next);
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!selectedNode) {
    return (
      <aside className="w-64 flex-shrink-0 border-l border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-400 text-center mt-8">
          Select a skill to inspect it
        </p>
      </aside>
    );
  }

  const accentColor = nodeDef?.color ?? nodeDef?.packs?.color ?? '#6B7280';
  const bindableFields = (nodeDef?.config_schema ?? []).filter((field) => (
    field.type === 'resource' ||
    field['ui:widget'] === 'resource-picker' ||
    field.ui?.widget === 'resource-picker' ||
    Boolean(field['ui:resourceType'] ?? field.resourceType ?? field.ui?.resourceType)
  ));
  const hasBindingsTab = bindableFields.length > 0;

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col overflow-hidden border-l border-gray-200 bg-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 p-3 border-b border-gray-100"
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
          Skill Inspector
        </p>
        <p className="text-[10px] text-gray-400">
          {nodeDef?.packs?.display_name ?? '—'} · {nodeDef?.version ?? 'v1.0.0'}
        </p>
        <input
          type="text"
          value={labelValue}
          onChange={(e) => {
            setLabelValue(e.target.value);
            if (selectedNode) onLabelChange?.(selectedNode.id, e.target.value);
          }}
          placeholder={nodeDef?.name ?? 'Node label'}
          title="Click to rename this node"
          className="mt-0.5 w-full rounded border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none bg-transparent px-1 py-0.5 font-semibold text-gray-900 text-sm leading-snug"
        />
        {nodeDef?.description && (
          <p className="mt-1 text-[11px] text-gray-500 leading-snug">{nodeDef.description}</p>
        )}
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Input / Output ports */}
        {!loading && nodeDef && (
          (nodeDef.inputs?.length || nodeDef.outputs?.length) ? (
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Inputs
                  </p>
                  {(nodeDef.inputs ?? []).length === 0 ? (
                    <p className="text-[10px] text-gray-300 italic">none</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {(nodeDef.inputs ?? []).map((port) => (
                        <PortListItem key={port.id ?? port.label ?? port.name} port={port} />
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Outputs
                  </p>
                  {(nodeDef.outputs ?? []).length === 0 ? (
                    <p className="text-[10px] text-gray-300 italic">none</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {(nodeDef.outputs ?? []).map((port) => (
                        <PortListItem key={port.id ?? port.label ?? port.name} port={port} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* Services + Data Pack dependencies */}
        {!loading && nodeDef && (
          (nodeDef.uses_services?.length || nodeDef.data_pack_deps?.length) ? (
            <div className="px-3 py-2 border-b border-gray-100 space-y-1.5">
              {nodeDef.uses_services && nodeDef.uses_services.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Uses Services
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {nodeDef.uses_services.map((svc) => <ServiceChip key={svc} svc={svc} />)}
                  </div>
                </div>
              )}
              {nodeDef.data_pack_deps && nodeDef.data_pack_deps.length > 0 && (
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Requires Data Packs
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {nodeDef.data_pack_deps.map((slug) => <DataPackChip key={slug} slug={slug} />)}
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* Resource requirements */}
        {!loading && nodeDef && (nodeDef.resource_requirements?.length ?? 0) > 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Resource Access
            </p>
            <ul className="space-y-1">
              {(nodeDef.resource_requirements ?? []).map((req) => (
                <li key={req.resourceType} className="flex items-start gap-1.5 text-[10px] text-gray-600">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">⚑</span>
                  <span>
                    <span className="font-medium text-gray-700">{req.resourceType}</span>
                    {req.access && (
                      <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500 font-mono">
                        {req.access}
                      </span>
                    )}
                    {req.description && (
                      <span className="block text-gray-400 text-[9px]">{req.description}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Config fields — manifest-driven ─────────────────────────────── */}
        <div className="p-3">
          {hasBindingsTab && (
            <div className="mb-3 grid grid-cols-2 rounded border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'config'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Config
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bindings')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'bindings'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Bindings
              </button>
            </div>
          )}

          {loading && (
            <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
          )}

          {!loading && !nodeDef && (
            <p className="text-xs text-gray-400 text-center py-4 italic">
              Could not load skill definition.
              <br />
              <span className="text-[10px] font-mono">
                {selectedNode.data?.nodeType as string}
              </span>
            </p>
          )}

          {!loading && nodeDef && activeTab === 'config' && (
            <ConfigFields
              nodeDef={nodeDef}
              config={config}
              onChange={handleChange}
              organizationId={organizationId}
              projectId={projectId}
            />
          )}

          {!loading && nodeDef && activeTab === 'bindings' && (
            <ResourceBindingPanel
              workflowId={workflowId}
              nodeId={selectedNode.id}
              fields={nodeDef.config_schema}
              organizationId={organizationId}
            />
          )}
        </div>

      </div>{/* end scrollable body */}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 border-t border-gray-100 flex items-center gap-2">
        <p className="text-[10px] font-mono text-gray-400 truncate flex-1">
          {selectedNode.data?.nodeType ?? '—'}
        </p>
        {onDeleteNode && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="flex-shrink-0 text-[10px] text-gray-300 hover:text-red-500 hover:bg-red-50 rounded px-1.5 py-0.5 transition-colors"
            title="Delete skill (Del)"
          >
            🗑 Remove
          </button>
        )}
      </div>

    </aside>
  );
}
