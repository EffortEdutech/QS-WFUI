'use client';

/**
 * NodePalette — sidebar listing available business capability nodes.
 * Drag a node from here onto the canvas to add it.
 *
 * Sprint 5: driven by live GET /api/v1/nodes API.
 * Nodes grouped by category, with pack badge and search.
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface RegisteredNode {
  type: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  color?: string;
  tags?: string[];
  pack_id: string;
  packs?: {
    id: string;
    display_name: string;
    color?: string;
    icon?: string;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  qs: 'QS',
  procurement: 'Procurement',
  document: 'Document',
  ai: 'AI',
  integration: 'Integration',
};

const CATEGORY_ORDER = ['core', 'qs', 'procurement', 'document', 'ai', 'integration'];

export default function NodePalette() {
  const [nodes, setNodes] = useState<RegisteredNode[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<RegisteredNode[]>('/nodes')
      .then((res) => setNodes(res.data ?? []))
      .catch(() => setError('Failed to load nodes'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.type.toLowerCase().includes(search.toLowerCase()) ||
          n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : nodes;

  const grouped = CATEGORY_ORDER.reduce<Record<string, RegisteredNode[]>>((acc, cat) => {
    const items = filtered.filter((n) => n.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const onDragStart = (event: React.DragEvent, node: RegisteredNode) => {
    event.dataTransfer.setData('application/qsos-node-type', node.type);
    event.dataTransfer.setData('application/qsos-node-label', node.name);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header + search */}
      <div className="p-3 border-b border-gray-100">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Node Library
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
        />
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Loading nodes…</p>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center py-4">{error}</p>
        )}
        {!loading && !error && Object.keys(grouped).length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No nodes found</p>
        )}
        {!loading &&
          !error &&
          Object.entries(grouped).map(([category, catNodes]) => (
            <div key={category} className="mb-4">
              <p className="mb-1 text-[11px] font-semibold text-gray-500">
                {CATEGORY_LABELS[category] ?? category} Pack
              </p>
              <div className="space-y-1">
                {catNodes.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, node)}
                    className="flex cursor-grab items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
                    title={`${node.type}\n${node.description ?? ''}`}
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: node.color ?? '#6B7280' }}
                    />
                    <span className="truncate">{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}
