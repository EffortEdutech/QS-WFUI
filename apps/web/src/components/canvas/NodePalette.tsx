'use client';

/**
 * NodePalette — "Skill Library" in V3 terminology.
 *
 * Shows all available skills grouped by Capability Pack.
 * Drag a skill card onto the canvas to add it as a node.
 *
 * Sprint 5:  initial — flat list driven by live GET /api/v1/nodes
 * Sprint 13: V3 — renamed "Skill Library", grouped by pack, service chips,
 *                  search filters across name + description + tags.
 */

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SkillMode } from '@lados/shared-types';

// ── Type definitions ──────────────────────────────────────────────────────────

interface RegisteredNode {
  type: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  color?: string;
  tags?: string[];
  pack_id: string;
  uses_services?: string[];
  data_pack_deps?: string[];
  packs?: {
    id: string;
    display_name: string;
    color?: string;
    icon?: string;
  };
}

// ── Service chip helpers ──────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, string> = {
  'ai-service':       '🤖',
  'storage-service':  '💾',
  'audit-service':    '📋',
  'auth-service':     '🔐',
  'ocr-service':      '🔍',
  'document-service': '📄',
  'notification-service': '🔔',
};

const SERVICE_LABELS: Record<string, string> = {
  'ai-service':       'AI',
  'storage-service':  'Storage',
  'audit-service':    'Audit',
  'auth-service':     'Auth',
  'ocr-service':      'OCR',
  'document-service': 'Docs',
  'notification-service': 'Notify',
};

function ServiceChip({ service }: { service: string }) {
  const icon  = SERVICE_ICONS[service]  ?? '⚙';
  const label = SERVICE_LABELS[service] ?? service;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-500"
      title={service}
    >
      {icon} {label}
    </span>
  );
}

// ── Pack section ──────────────────────────────────────────────────────────────

interface PackSectionProps {
  packName: string;
  packColor?: string;
  nodes: RegisteredNode[];
  onDragStart: (e: React.DragEvent, node: RegisteredNode) => void;
  onBulkMode?: (nodeTypes: string[], mode: SkillMode) => void;
  defaultOpen?: boolean;
}

const BULK_ACTIONS: { mode: SkillMode; icon: string; title: string }[] = [
  { mode: 'active',   icon: '▶',  title: 'Activate All' },
  { mode: 'muted',    icon: '🔇', title: 'Mute All'     },
  { mode: 'bypassed', icon: '⏭',  title: 'Bypass All'   },
];

function PackSection({ packName, packColor, nodes, onDragStart, onBulkMode, defaultOpen = true }: PackSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hoverHeader, setHoverHeader] = useState(false);

  const nodeTypes = nodes.map((n) => n.type);

  return (
    <div className="mb-3">
      {/* Pack header */}
      <div
        className="flex w-full items-center justify-between gap-1 mb-1"
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 min-w-0 group"
        >
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: packColor ?? '#6B7280' }}
          />
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            {packName}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            ({nodes.length})
          </span>
          <span className="text-[10px] text-gray-300 group-hover:text-gray-400 flex-shrink-0 ml-auto">
            {open ? '▾' : '▸'}
          </span>
        </button>

        {/* Bulk mode controls — visible on hover when onBulkMode is provided */}
        {onBulkMode && (
          <div
            className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${
              hoverHeader ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {BULK_ACTIONS.map(({ mode, icon, title }) => (
              <button
                key={mode}
                onClick={(e) => { e.stopPropagation(); onBulkMode(nodeTypes, mode); }}
                title={title}
                className="rounded px-1 py-0.5 text-[9px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Skill cards */}
      {open && (
        <div className="space-y-1 pl-3 border-l-2" style={{ borderColor: packColor ? `${packColor}40` : '#E5E7EB' }}>
          {nodes.map((node) => (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e, node)}
              className="cursor-grab rounded border border-gray-200 bg-gray-50 px-2 py-1.5 hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing transition-colors"
              title={`${node.type}${node.description ? '\n' + node.description : ''}`}
            >
              {/* Skill name */}
              <div className="flex items-center gap-1.5">
                {node.icon ? (
                  <span className="text-xs">{node.icon}</span>
                ) : (
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: node.color ?? packColor ?? '#6B7280' }}
                  />
                )}
                <span className="text-xs font-medium text-gray-800 truncate">{node.name}</span>
              </div>

              {/* Description (single line) */}
              {node.description && (
                <p className="mt-0.5 text-[10px] text-gray-400 leading-tight line-clamp-1">
                  {node.description}
                </p>
              )}

              {/* Service chips */}
              {node.uses_services && node.uses_services.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {node.uses_services.map((svc) => (
                    <ServiceChip key={svc} service={svc} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface NodePaletteProps {
  /** Called when a bulk mode action is triggered on a pack group header. */
  onBulkMode?: (nodeTypes: string[], mode: SkillMode) => void;
}

export default function NodePalette({ onBulkMode }: NodePaletteProps = {}) {
  const [nodes, setNodes]   = useState<RegisteredNode[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all nodes on mount
  useEffect(() => {
    apiClient
      .get<RegisteredNode[]>('/nodes')
      .then((res) => setNodes(res.data ?? []))
      .catch(() => setError('Failed to load skills'))
      .finally(() => setLoading(false));
  }, []);

  // Server-side search with 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search.trim()) {
      // Reset to full list (already loaded)
      debounceRef.current = null;
      apiClient
        .get<RegisteredNode[]>('/nodes')
        .then((res) => setNodes(res.data ?? []));
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      apiClient
        .get<RegisteredNode[]>(`/nodes/search?q=${encodeURIComponent(search.trim())}`)
        .then((res) => setNodes(res.data ?? []))
        .catch(() => setError('Search failed'))
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const filtered = nodes;

  // Group by pack, preserving pack metadata
  const packMap = new Map<string, { name: string; color?: string; nodes: RegisteredNode[] }>();
  for (const node of filtered) {
    const packId   = node.pack_id;
    const packName = node.packs?.display_name ?? packId;
    const packColor = node.packs?.color ?? undefined;
    if (!packMap.has(packId)) {
      packMap.set(packId, { name: packName, color: packColor, nodes: [] });
    }
    packMap.get(packId)!.nodes.push(node);
  }

  const packs = Array.from(packMap.entries()).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );

  const onDragStart = (event: React.DragEvent, node: RegisteredNode) => {
    event.dataTransfer.setData('application/qsos-node-type', node.type);
    event.dataTransfer.setData('application/qsos-node-label', node.name);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header + search */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Skill Library
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills…"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
        />
      </div>

      {/* Pack-grouped skill list */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Loading skills…</p>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center py-4">{error}</p>
        )}
        {!loading && !error && packs.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            {search.trim() ? 'No skills match your search' : 'No skills available'}
          </p>
        )}

        {!loading && !error && packs.map(([packId, pack]) => (
          <PackSection
            key={packId}
            packName={pack.name}
            packColor={pack.color}
            nodes={pack.nodes}
            onDragStart={onDragStart}
            onBulkMode={onBulkMode}
            defaultOpen={true}
          />
        ))}

        {/* Drag hint */}
        {!loading && !error && packs.length > 0 && (
          <p className="mt-3 text-[10px] text-center text-gray-300">
            Drag a skill onto the canvas
          </p>
        )}
      </div>
    </aside>
  );
}
