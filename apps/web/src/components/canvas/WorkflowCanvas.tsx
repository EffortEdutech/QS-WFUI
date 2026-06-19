'use client';

/**
 * WorkflowCanvas — React Flow canvas for the QS-OS workflow editor.
 *
 * Sprint 2:  initial React Flow integration
 * Sprint 13: V3 — custom SkillNode with mode visual states (active/muted/bypassed),
 *             right-click context menu for mode toggle, mode persisted in workflow JSON
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import type {
  QSWorkflowDefinition,
  WorkflowNodeInstance,
  WorkflowConnection,
  SkillMode,
} from '@qsos/shared-types';
import PropertyPanel from './PropertyPanel';
import { ConditionNode } from './ConditionNode';

// ── Custom SkillNode ──────────────────────────────────────────────────────────
//
// Three visual states driven by data.mode:
//   active   — white card, solid border (default)
//   muted    — gray/dim, 🔇 badge, outputs null at runtime
//   bypassed — dashed amber border, ⏭ badge, passes input[0] through at runtime

function SkillNode({ data, selected }: NodeProps) {
  const mode: SkillMode = (data.mode as SkillMode) ?? 'active';

  const selectedRing = selected ? 'ring-2 ring-offset-1 ' : '';

  const containerCls =
    mode === 'muted'
      ? `bg-gray-100 border border-gray-300 opacity-55 ${selectedRing}${selected ? 'ring-blue-300' : ''}`
      : mode === 'bypassed'
        ? `bg-white border-2 border-dashed border-amber-400 ${selectedRing}${selected ? 'ring-amber-300' : ''}`
        : `bg-white border border-gray-300 ${selectedRing}${selected ? 'ring-blue-400' : ''}`;

  return (
    <div
      className={`relative rounded px-3 py-2 text-xs font-medium min-w-[120px] text-center shadow-sm transition-all ${containerCls}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#9ca3af', width: 8, height: 8 }}
      />

      {/* Mode badge — only when not active */}
      {mode !== 'active' && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap ${
            mode === 'muted'
              ? 'bg-gray-200 text-gray-500'
              : 'bg-amber-100 text-amber-600'
          }`}
        >
          {mode === 'muted' ? '🔇 muted' : '⏭ bypass'}
        </span>
      )}

      <span className={mode === 'muted' ? 'text-gray-400' : 'text-gray-800'}>
        {data.label as string}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9ca3af', width: 8, height: 8 }}
      />
    </div>
  );
}

// Stable module-level constant — prevents React Flow nodeTypes warning.
// 'condition' uses ConditionNode (teal diamond); everything else uses SkillNode.
const NODE_TYPES: NodeTypes = {
  skill:     SkillNode,
  condition: ConditionNode,
};

// ── Helpers: convert QS-OS types ↔ React Flow types ─────────────────────────

function rfNodeType(nodeType: string): string {
  return nodeType === 'workflow.condition' ? 'condition' : 'skill';
}

function toRFNodes(nodes: WorkflowNodeInstance[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: rfNodeType(n.type),
    position: n.position,
    data: {
      label: n.label ?? n.type,
      nodeType: n.type,
      config: n.config ?? {},
      mode: n.mode ?? 'active',
      // expose expression at top level for ConditionNode rendering
      expression: (n.config?.['expression'] as string | undefined) ?? undefined,
    },
  }));
}

function toRFEdges(connections: WorkflowConnection[]): Edge[] {
  return connections.map((c) => ({
    id: c.id,
    source: c.sourceNodeId,
    sourceHandle: c.sourcePortId,
    target: c.targetNodeId,
    targetHandle: c.targetPortId,
  }));
}

function fromRFNodes(rfNodes: Node[]): WorkflowNodeInstance[] {
  return rfNodes.map((n) => ({
    id: n.id as WorkflowNodeInstance['id'],
    type: (n.data as { nodeType: string }).nodeType as WorkflowNodeInstance['type'],
    label: (n.data as { label: string }).label,
    position: n.position,
    config: (n.data as { config: Record<string, unknown> }).config,
    mode: ((n.data as { mode?: SkillMode }).mode ?? 'active') as SkillMode,
  }));
}

function fromRFEdges(rfEdges: Edge[]): WorkflowConnection[] {
  return rfEdges.map((e) => ({
    id: e.id,
    sourceNodeId: e.source as WorkflowConnection['sourceNodeId'],
    sourcePortId: e.sourceHandle ?? 'out',
    targetNodeId: e.target as WorkflowConnection['targetNodeId'],
    targetPortId: e.targetHandle ?? 'in',
  }));
}

// ── Context menu type ─────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

const MODE_OPTIONS: { mode: SkillMode; icon: string; label: string; desc: string }[] = [
  { mode: 'active',   icon: '▶',  label: 'Active',  desc: 'Normal execution'    },
  { mode: 'muted',    icon: '🔇', label: 'Mute',    desc: 'Skip, output null'   },
  { mode: 'bypassed', icon: '⏭',  label: 'Bypass',  desc: 'Pass input through'  },
];

// ── Component ─────────────────────────────────────────────────────────────────

/** Opaque request to bulk-set mode on a set of node types. `stamp` must be unique per request. */
export interface BulkModeRequest {
  nodeTypes: string[];
  mode: SkillMode;
  stamp: number;
}

interface WorkflowCanvasProps {
  definition: QSWorkflowDefinition;
  onSave?: (updated: QSWorkflowDefinition) => void;
  readOnly?: boolean;
  organizationId?: string;
  projectId?: string;
  /** When set (and stamp changes), bulk-applies mode to all canvas nodes matching nodeTypes. */
  bulkModeRequest?: BulkModeRequest | null;
}

export default function WorkflowCanvas({
  definition,
  onSave,
  readOnly = false,
  organizationId,
  projectId,
  bulkModeRequest,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(definition.nodes ?? []));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(definition.connections ?? []));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Apply bulk mode to all canvas nodes whose nodeType matches the request */
  useEffect(() => {
    if (!bulkModeRequest) return;
    const { nodeTypes, mode } = bulkModeRequest;
    const typeSet = new Set(nodeTypes);
    setNodes((nds) => {
      const updated = nds.map((n) =>
        typeSet.has((n.data as { nodeType: string }).nodeType)
          ? { ...n, data: { ...n.data, mode } }
          : n,
      );
      scheduleAutoSave(updated, edges);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkModeRequest?.stamp]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, id: `e-${Date.now()}` }, eds));
    },
    [setEdges],
  );

  /** Debounce