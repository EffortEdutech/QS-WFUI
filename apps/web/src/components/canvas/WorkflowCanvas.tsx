'use client';

/**
 * WorkflowCanvas — React Flow canvas for the QS-OS workflow editor.
 *
 * Sprint 2:  initial React Flow integration
 * Sprint 13: V3 — SkillNode mode states, right-click context menu, bulk mode
 * Sprint 18: S18-001 — connection validation (red/amber edges, validation banner)
 *            S18-004 — canvas UX (undo/redo, minimap toggle, fit-view, duplicate, copy/paste)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
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
  WorkflowSkillGroup,
  WorkflowFastGroupBypasser,
} from '@lados/shared-types';
import { apiClient } from '@/lib/api/client';
import {
  PORT_COLORS,
  getPortLabel,
  getPortType,
  isPortCompatible,
  type PortDataType,
} from '@/lib/portTypes';
import PropertyPanel from './PropertyPanel';
import { ConditionNode } from './ConditionNode';
import SkillGroupNode from './SkillGroupNode';
import FastGroupBypasserNode from './FastGroupBypasserNode';
import RunGroupModal from './RunGroupModal';
import { useCanvasStore } from '@/stores';

// ── Custom SkillNode (V2) ─────────────────────────────────────────────────────
//
// Three visual states driven by data.mode:
//   active   — white card, solid border (default)
//   muted    — gray/dim, 🔇 badge, outputs null at runtime
//   bypassed — dashed amber border, ⏭ badge, passes input[0] through at runtime
//
// V2 additions (Phase 4A):
//   data.icon     — emoji or SVG string; shown left of title
//   data.color    — hex or named color; used as left-border accent
//   data.category — text badge below title (e.g. "document", "ai", "qs")

const CATEGORY_COLORS: Record<string, string> = {
  ai:          'bg-purple-100 text-purple-700',
  document:    'bg-blue-100   text-blue-700',
  qs:          'bg-green-100  text-green-700',
  procurement: 'bg-amber-100  text-amber-700',
  storage:     'bg-cyan-100   text-cyan-700',
  auth:        'bg-red-100    text-red-700',
  audit:       'bg-gray-100   text-gray-700',
};

function SkillNode({ data, selected }: NodeProps) {
  const mode: SkillMode = (data.mode as SkillMode) ?? 'active';
  const icon      = data.icon     as string | undefined;
  const color     = data.color    as string | undefined;
  const category  = data.category as string | undefined;
  const inputs    = (data.inputs  as NodePort[] | undefined) ?? [];
  const outputs   = (data.outputs as NodePort[] | undefined) ?? [];
  const selectedRing = selected ? 'ring-2 ring-offset-1 ' : '';

  const containerCls =
    mode === 'muted'
      ? `bg-gray-100 border border-gray-300 opacity-55 ${selectedRing}${selected ? 'ring-blue-300' : ''}`
      : mode === 'bypassed'
        ? `bg-white border-2 border-dashed border-amber-400 ${selectedRing}${selected ? 'ring-amber-300' : ''}`
        : `bg-white border border-gray-300 ${selectedRing}${selected ? 'ring-blue-400' : ''}`;

  // V2: left color accent bar
  const accentStyle = color && mode === 'active'
    ? { borderLeft: `3px solid ${color}` }
    : {};

  // Category badge colors
  const catKey = category?.split('.')[0] ?? '';
  const catCls = CATEGORY_COLORS[catKey] ?? 'bg-gray-100 text-gray-500';
  const inputHandles = inputs.length > 0 ? inputs : [{ id: 'in', label: 'in', type: 'any' }];
  const outputHandles = outputs.length > 0 ? outputs : [{ id: 'out', label: 'out', type: 'any' }];
  const needsLegacyInputHandle = !inputHandles.some((port) => port.id === 'in');
  const needsLegacyOutputHandle = !outputHandles.some((port) => port.id === 'out');
  const visibleRowCount = Math.max(inputs.length, outputs.length);
  const nodeMinHeight = visibleRowCount > 0 ? 66 + visibleRowCount * 22 : 58;

  const handleTop = (index: number, visibleCount: number): string | number => {
    if (visibleCount === 0) return '50%';
    return (category ? 68 : 52) + index * 22;
  };

  const renderPortHandle = (port: NodePort, index: number, visibleCount: number, side: 'input' | 'output') => {
    const portType = getPortType(port) ?? 'any';
    const isInput = side === 'input';

    return (
      <div key={`${side}-${port.id}`}>
        <Handle
          id={port.id}
          type={isInput ? 'target' : 'source'}
          position={isInput ? Position.Left : Position.Right}
          style={{
            top: handleTop(index, visibleCount),
            background: PORT_COLORS[portType],
            border: '2px solid #fff',
            width: 10,
            height: 10,
          }}
        />
      </div>
    );
  };

  const renderLegacyCompatibilityHandle = (side: 'input' | 'output') => {
    const isInput = side === 'input';

    return (
      <Handle
        id={isInput ? 'in' : 'out'}
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        style={{
          top: '50%',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
          background: 'transparent',
        }}
      />
    );
  };

  const renderPortRow = (port: NodePort, side: 'input' | 'output') => {
    const portType = getPortType(port) ?? 'any';
    const isInput = side === 'input';

    return (
      <div
        key={`${side}-row-${port.id}`}
        className={`flex h-[18px] min-w-0 items-center gap-1.5 text-[10px] font-normal leading-none text-gray-600 ${
          isInput ? 'justify-start pl-1' : 'justify-end pr-1 text-right'
        }`}
        title={`${getPortLabel(port)} (${portType})`}
      >
        <span className="min-w-0 truncate">{getPortLabel(port)}</span>
        <span className="flex-shrink-0 font-mono text-[8px] uppercase text-gray-400">
          {portType}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`group relative w-[260px] rounded px-3 py-2 text-xs font-medium shadow-sm transition-all ${containerCls}`}
      style={{ ...accentStyle, minHeight: nodeMinHeight }}
    >
      {inputHandles.map((port, index) =>
        renderPortHandle(port, index, inputs.length, 'input'),
      )}
      {needsLegacyInputHandle && renderLegacyCompatibilityHandle('input')}

      {/* Mode badge */}
      {mode !== 'active' && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap ${
            mode === 'muted' ? 'bg-gray-200 text-gray-500' : 'bg-amber-100 text-amber-600'
          }`}
        >
          {mode === 'muted' ? '🔇 muted' : '⏭ bypass'}
        </span>
      )}

      {/* Title row: icon + label */}
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm leading-none flex-shrink-0">{icon}</span>}
        <span className={`truncate ${mode === 'muted' ? 'text-gray-400' : 'text-gray-800'}`}>
          {data.label as string}
        </span>
      </div>

      {/* Category badge */}
      {category && (
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${catCls}`}>
          {category}
        </span>
      )}

      {visibleRowCount > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 border-t border-gray-100 pt-1.5">
          <div className="space-y-1 overflow-hidden">
            {inputs.map((port) => renderPortRow(port, 'input'))}
          </div>
          <div className="space-y-1 overflow-hidden">
            {outputs.map((port) => renderPortRow(port, 'output'))}
          </div>
        </div>
      )}

      {outputHandles.map((port, index) =>
        renderPortHandle(port, index, outputs.length, 'output'),
      )}
      {needsLegacyOutputHandle && renderLegacyCompatibilityHandle('output')}
    </div>
  );
}

// Stable module-level constant — prevents React Flow nodeTypes warning
const NODE_TYPES: NodeTypes = {
  skill:     SkillNode,
  condition: ConditionNode,
  skillGroup: SkillGroupNode,
  fastGroupBypasser: FastGroupBypasserNode,
};

// ── Helpers: convert QS-OS types ↔ React Flow types ──────────────────────────

const GROUP_NODE_PREFIX = 'group:';
const FAST_GROUP_BYPASSER_PREFIX = 'fastGroupBypasser:';
const GROUP_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#be123c'];

function groupNodeId(groupId: string): string {
  return `${GROUP_NODE_PREFIX}${groupId}`;
}

function groupIdFromNodeId(nodeId: string): string {
  return nodeId.replace(GROUP_NODE_PREFIX, '');
}

function isGroupNode(node: Node): boolean {
  return node.type === 'skillGroup' || node.id.startsWith(GROUP_NODE_PREFIX);
}

function fastGroupBypasserNodeId(bypasserId: string): string {
  return `${FAST_GROUP_BYPASSER_PREFIX}${bypasserId}`;
}

function fastGroupBypasserIdFromNodeId(nodeId: string): string {
  return nodeId.replace(FAST_GROUP_BYPASSER_PREFIX, '');
}

function isFastGroupBypasserNode(node: Node): boolean {
  return node.type === 'fastGroupBypasser' || node.id.startsWith(FAST_GROUP_BYPASSER_PREFIX);
}

function isCanvasUtilityNode(node: Node): boolean {
  return isGroupNode(node) || isFastGroupBypasserNode(node);
}

function canvasNodesOnly(nodes: Node[]): Node[] {
  return nodes.filter((node) => !isCanvasUtilityNode(node));
}

function normalizeGroups(groups?: WorkflowSkillGroup[]): WorkflowSkillGroup[] {
  return (groups ?? []).map((group) => ({
    ...group,
    color: group.color || '#2563eb',
    mode: group.mode ?? 'active',
    collapsed: group.collapsed ?? false,
    toggleRestriction: group.toggleRestriction ?? 'default',
    nodeIds: group.nodeIds ?? [],
    bounds: {
      x: group.bounds?.x ?? 0,
      y: group.bounds?.y ?? 0,
      width: Math.max(group.bounds?.width ?? 280, 180),
      height: Math.max(group.bounds?.height ?? 180, 80),
    },
  }));
}

function normalizeFastGroupBypassers(bypassers?: WorkflowFastGroupBypasser[]): WorkflowFastGroupBypasser[] {
  return (bypassers ?? []).map((bypasser) => ({
    ...bypasser,
    name: bypasser.name ?? 'Group Mode Switcher',
    collapsed: bypasser.collapsed ?? false,
    position: {
      x: bypasser.position?.x ?? 80,
      y: bypasser.position?.y ?? 80,
    },
  }));
}

function createGroupNode(group: WorkflowSkillGroup, data: Record<string, unknown>): Node {
  const collapsed = group.collapsed ?? false;

  return {
    id: groupNodeId(group.id),
    type: 'skillGroup',
    position: { x: group.bounds.x, y: group.bounds.y },
    data,
    draggable: true,
    selectable: true,
    zIndex: -1,
    style: {
      width: collapsed ? 220 : group.bounds.width,
      height: collapsed ? 56 : group.bounds.height,
    },
  };
}

function createFastGroupBypasserNode(
  bypasser: WorkflowFastGroupBypasser,
  data: Record<string, unknown>,
): Node {
  return {
    id: fastGroupBypasserNodeId(bypasser.id),
    type: 'fastGroupBypasser',
    position: bypasser.position,
    data,
    draggable: true,
    selectable: true,
    dragHandle: '.fgb-drag-handle',
    zIndex: 2,
  };
}

function groupBoundsFromNode(node: Node, fallback: WorkflowSkillGroup): WorkflowSkillGroup['bounds'] {
  const width = Number((node.style as { width?: number | string } | undefined)?.width ?? node.width ?? fallback.bounds.width);
  const height = Number((node.style as { height?: number | string } | undefined)?.height ?? node.height ?? fallback.bounds.height);

  return {
    x: node.position.x,
    y: node.position.y,
    width: Number.isFinite(width) ? Math.max(width, 180) : fallback.bounds.width,
    height: Number.isFinite(height) ? Math.max(height, 80) : fallback.bounds.height,
  };
}

function sameGroupBounds(
  a: WorkflowSkillGroup['bounds'] | undefined,
  b: WorkflowSkillGroup['bounds'] | undefined,
): boolean {
  return Boolean(
    a &&
      b &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height,
  );
}

function samePosition(
  a: WorkflowFastGroupBypasser['position'] | undefined,
  b: WorkflowFastGroupBypasser['position'] | undefined,
): boolean {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isLiveNodeDragChange(change: NodeChange): boolean {
  return change.type === 'position' && 'dragging' in change && change.dragging === true;
}

function rfNodeType(nodeType: string): string {
  return nodeType === 'workflow.condition' ? 'condition' : 'skill';
}

function toRFNodes(nodes: WorkflowNodeInstance[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: rfNodeType(n.type),
    position: n.position,
    data: {
      label:      n.label ?? n.type,
      nodeType:   n.type,
      config:     n.config ?? {},
      mode:       n.mode ?? 'active',
      expression: (n.config?.['expression'] as string | undefined) ?? undefined,
      // V2 manifest fields (stored in config or as top-level node properties)
      icon:     (n as { icon?: string }).icon     ?? (n.config?.['_icon']     as string | undefined),
      color:    (n as { color?: string }).color   ?? (n.config?.['_color']    as string | undefined),
      category: (n as { category?: string }).category ?? (n.config?.['_category'] as string | undefined),
    },
  }));
}

function toRFEdges(connections: WorkflowConnection[]): Edge[] {
  return connections.map((c) => ({
    id:           c.id,
    source:       c.sourceNodeId,
    sourceHandle: c.sourcePortId,
    target:       c.targetNodeId,
    targetHandle: c.targetPortId,
  }));
}

function fromRFNodes(rfNodes: Node[]): WorkflowNodeInstance[] {
  return canvasNodesOnly(rfNodes).map((n) => ({
    id:       n.id as WorkflowNodeInstance['id'],
    type:     (n.data as { nodeType: string }).nodeType as WorkflowNodeInstance['type'],
    label:    (n.data as { label: string }).label,
    position: n.position,
    config:   (n.data as { config: Record<string, unknown> }).config,
    mode:     ((n.data as { mode?: SkillMode }).mode ?? 'active') as SkillMode,
  }));
}

function fromRFEdges(rfEdges: Edge[]): WorkflowConnection[] {
  return rfEdges.map((e) => ({
    id:           e.id,
    sourceNodeId: e.source as WorkflowConnection['sourceNodeId'],
    sourcePortId: e.sourceHandle ?? 'out',
    targetNodeId: e.target as WorkflowConnection['targetNodeId'],
    targetPortId: e.targetHandle ?? 'in',
  }));
}

// ── S18-001: Validation ───────────────────────────────────────────────────────

interface NodePort {
  id: string;
  label?: string;
  name?: string;
  type?: string;
  dataType?: string;
  required?: boolean;
}

interface NodeDef {
  inputs:  NodePort[];
  outputs: NodePort[];
}

export interface ValidationError {
  edgeId:    string;
  message:   string;
  severity:  'error' | 'warning';
}

function computeValidation(
  nodes: Node[],
  edges: Edge[],
  registry: Map<string, NodeDef>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const seen    = new Map<string, true>();

  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);

    if (!src || !tgt) {
      errors.push({ edgeId: edge.id, message: 'Connected node not found', severity: 'error' });
      continue;
    }

    // Self-loop
    if (edge.source === edge.target) {
      errors.push({
        edgeId:   edge.id,
        message:  `Self-connection on "${src.data.label as string}"`,
        severity: 'error',
      });
      continue;
    }

    // Duplicate connection
    const sourceHandle = edge.sourceHandle ?? 'out';
    const targetHandle = edge.targetHandle ?? 'in';
    const pairKey = `${edge.source}:${sourceHandle}->${edge.target}:${targetHandle}`;
    if (seen.has(pairKey)) {
      errors.push({
        edgeId:   edge.id,
        message:  `Duplicate: "${src.data.label as string}" -> "${tgt.data.label as string}"`,
        severity: 'warning',
      });
    } else {
      seen.set(pairKey, true);
    }

    // Port compatibility (when registry is loaded)
    if (registry.size > 0) {
      const srcDef = registry.get((src.data as { nodeType: string }).nodeType);
      const tgtDef = registry.get((tgt.data as { nodeType: string }).nodeType);

      if (srcDef && srcDef.outputs.length === 0) {
        errors.push({
          edgeId:   edge.id,
          message:  `"${src.data.label as string}" has no outputs`,
          severity: 'warning',
        });
      }
      if (tgtDef && tgtDef.inputs.length === 0) {
        errors.push({
          edgeId:   edge.id,
          message:  `"${tgt.data.label as string}" has no inputs`,
          severity: 'warning',
        });
      }

      const sourcePort = srcDef?.outputs.find((port) => port.id === sourceHandle);
      const targetPort = tgtDef?.inputs.find((port) => port.id === targetHandle);
      const sourceType = getPortType(sourcePort);
      const targetType = getPortType(targetPort);

      if (!isPortCompatible(sourceType, targetType)) {
        errors.push({
          edgeId:   edge.id,
          message:  `Type mismatch: ${sourceType} cannot connect to ${targetType}`,
          severity: 'error',
        });
      }
    }
  }
  return errors;
}

// ── Context menu type ─────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

const MODE_OPTIONS: { mode: SkillMode; icon: string; label: string; desc: string }[] = [
  { mode: 'active',   icon: '▶',  label: 'Active',  desc: 'Normal execution'   },
  { mode: 'muted',    icon: '🔇', label: 'Mute',    desc: 'Skip, output null'  },
  { mode: 'bypassed', icon: '⏭',  label: 'Bypass',  desc: 'Pass input through' },
];

// ── History snapshot ──────────────────────────────────────────────────────────

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

// ── Component types ───────────────────────────────────────────────────────────

/** Opaque request to bulk-set mode on a set of node types. `stamp` must be unique per request. */
export interface BulkModeRequest {
  nodeTypes: string[];
  mode:      SkillMode;
  stamp:     number;
}

/** Request to replace the canvas definition with an AI-generated draft. `stamp` must be unique per request. */
export interface DraftRequest {
  definition: QSWorkflowDefinition;
  stamp:      number;
}

interface WorkflowCanvasProps {
  definition:          QSWorkflowDefinition;
  onSave?:             (updated: QSWorkflowDefinition) => void;
  readOnly?:           boolean;
  organizationId?:     string;
  projectId?:          string;
  workflowId?:         string;
  bulkModeRequest?:    BulkModeRequest | null;
  draftRequest?:       DraftRequest | null;
  onGroupRunCompleted?: () => void;
  /** Called whenever canvas validation changes — true = has blocking errors, Run should be disabled */
  onValidationChange?: (hasErrors: boolean) => void;
}

// ── Public export: wraps with ReactFlowProvider so useReactFlow() works ───────

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────

function WorkflowCanvasInner({
  definition,
  onSave,
  readOnly = false,
  organizationId,
  projectId,
  workflowId,
  bulkModeRequest,
  draftRequest,
  onGroupRunCompleted,
  onValidationChange,
}: WorkflowCanvasProps) {
  const { fitView } = useReactFlow();
  const reactFlowNodeTypes = useMemo(() => NODE_TYPES, []);

  // ── Core canvas state ──────────────────────────────────────────────────────

  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(definition.nodes ?? []));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(definition.connections ?? []));
  const setStoreNodes = useCanvasStore((state) => state.setNodes);
  const setStoreEdges = useCanvasStore((state) => state.setEdges);
  const setStoreSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);
  const setStoreReadOnly = useCanvasStore((state) => state.setReadOnly);
  const setStoreHasValidationErrors = useCanvasStore((state) => state.setHasValidationErrors);
  const [groups, setGroups] = useState<WorkflowSkillGroup[]>(normalizeGroups(definition.ui?.groups));
  const [fastGroupBypassers, setFastGroupBypassers] = useState<WorkflowFastGroupBypasser[]>(
    normalizeFastGroupBypassers(definition.ui?.fastGroupBypassers),
  );
  const [runGroupId, setRunGroupId] = useState<string | null>(null);
  const [selectedSkillNodeIds, setSelectedSkillNodeIds] = useState<string[]>([]);
  const [selectedNode, setSelectedNode]   = useState<Node | null>(null);
  const [contextMenu, setContextMenu]     = useState<ContextMenuState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConnectionValidRef = useRef(true);

  // ── S18-001: Validation ────────────────────────────────────────────────────

  const [nodeRegistry, setNodeRegistry] = useState<Map<string, NodeDef>>(new Map());

  useEffect(() => {
    apiClient
      .get<{ type: string; inputs: NodePort[]; outputs: NodePort[] }[]>('/nodes')
      .then((res) => {
        if (!res.data) return;
        const map = new Map<string, NodeDef>();
        res.data.forEach((n) =>
          map.set(n.type, { inputs: n.inputs ?? [], outputs: n.outputs ?? [] }),
        );
        setNodeRegistry(map);
      })
      .catch(() => {/* validation works without registry — silently ignore */});
  }, []);

  useEffect(() => {
    if (nodeRegistry.size === 0) return;

    setNodes((nds) =>
      nds.map((node) => {
        const nodeType = (node.data as { nodeType?: string }).nodeType;
        const def = nodeType ? nodeRegistry.get(nodeType) : undefined;

        if (!def) return node;

        return {
          ...node,
          data: {
            ...node.data,
            inputs: def.inputs,
            outputs: def.outputs,
          },
        };
      }),
    );
  }, [nodeRegistry, setNodes]);

  const portTypeMap = useMemo(() => {
    const map = new Map<string, Map<string, PortDataType>>();

    for (const node of nodes) {
      const nodeType = (node.data as { nodeType?: string }).nodeType;
      const def = nodeType ? nodeRegistry.get(nodeType) : undefined;
      const ports = new Map<string, PortDataType>();

      for (const port of def?.inputs ?? []) {
        const type = getPortType(port);
        if (type) ports.set(port.id, type);
      }

      for (const port of def?.outputs ?? []) {
        const type = getPortType(port);
        if (type) ports.set(port.id, type);
      }

      if (ports.size > 0) {
        map.set(node.id, ports);
      }
    }

    return map;
  }, [nodes, nodeRegistry]);

  const validationErrors = useMemo(
    () => computeValidation(nodes, edges, nodeRegistry),
    [nodes, edges, nodeRegistry],
  );

  const hasErrors = validationErrors.some((e) => e.severity === 'error');

  useEffect(() => {
    onValidationChange?.(hasErrors);
    setStoreHasValidationErrors(hasErrors);
  }, [hasErrors, onValidationChange, setStoreHasValidationErrors]);

  useEffect(() => {
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    setStoreEdges(edges);
  }, [edges, setStoreEdges]);

  useEffect(() => {
    setStoreReadOnly(readOnly);
  }, [readOnly, setStoreReadOnly]);

  useEffect(() => {
    return () => {
      if (connectionErrorTimerRef.current) clearTimeout(connectionErrorTimerRef.current);
    };
  }, []);

  // Visual styling on edges: red = error, amber = warning, gray = ok
  const styledEdges = useMemo(() => {
    const errorIds = new Set(
      validationErrors.filter((e) => e.severity === 'error').map((e) => e.edgeId),
    );
    const warnIds = new Set(
      validationErrors.filter((e) => e.severity === 'warning').map((e) => e.edgeId),
    );
    return edges.map((edge) => ({
      ...edge,
      style: errorIds.has(edge.id)
        ? { stroke: '#ef4444', strokeWidth: 2 }
        : warnIds.has(edge.id)
          ? { stroke: '#f59e0b', strokeWidth: 1.5 }
          : { stroke: '#9ca3af', strokeWidth: 1 },
      animated: errorIds.has(edge.id),
    }));
  }, [edges, validationErrors]);

  // ── S18-004: Undo / Redo history ──────────────────────────────────────────

  const historyRef     = useRef<HistorySnapshot[]>([{
    nodes: toRFNodes(definition.nodes ?? []),
    edges: toRFEdges(definition.connections ?? []),
  }]);
  const historyIdxRef  = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function syncUndoRedoFlags() {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }

  /** Push a snapshot to history — no-op during restoration */
  function pushHistory(ns: Node[], es: Edge[]) {
    if (isRestoringRef.current) return;
    // Truncate any redo branch
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push({
      nodes: ns.map((n) => ({ ...n })),
      edges: es.map((e) => ({ ...e })),
    });
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    syncUndoRedoFlags();
  }

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snap = historyRef.current[historyIdxRef.current];
    isRestoringRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    scheduleAutoSave(snap.nodes, snap.edges);
    syncUndoRedoFlags();
    setTimeout(() => { isRestoringRef.current = false; }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const snap = historyRef.current[historyIdxRef.current];
    isRestoringRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    scheduleAutoSave(snap.nodes, snap.edges);
    syncUndoRedoFlags();
    setTimeout(() => { isRestoringRef.current = false; }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges]);

  // ── S18-004: Minimap + copy state ─────────────────────────────────────────

  const [showMinimap, setShowMinimap] = useState(true);
  const [copiedNode, setCopiedNode]   = useState<Node | null>(null);

  // ── S18-004: Duplicate node ────────────────────────────────────────────────

  const duplicateNode = useCallback(
    (node: Node) => {
      const newNode: Node = {
        ...node,
        id:       `${(node.data as { nodeType: string }).nodeType}-${Date.now()}`,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
      };
      setNodes((nds) => {
        const updated = [...nds, newNode];
        pushHistory(updated, edges);
        scheduleAutoSave(updated, edges);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNodes, edges],
  );

  // ── S18-004: Keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    if (readOnly) return;

    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      // Undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo(); return;
      }
      // Redo
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo(); return;
      }
      // Duplicate (Ctrl+D)
      if (mod && e.key === 'd' && selectedNode) {
        e.preventDefault(); duplicateNode(selectedNode); return;
      }
      // Copy (Ctrl+C)
      if (mod && e.key === 'c' && selectedNode) {
        setCopiedNode({ ...selectedNode }); return;
      }
      // Paste (Ctrl+V)
      if (mod && e.key === 'v' && copiedNode) {
        const pasted: Node = {
          ...copiedNode,
          id:       `${(copiedNode.data as { nodeType: string }).nodeType}-${Date.now()}`,
          position: { x: copiedNode.position.x + 60, y: copiedNode.position.y + 60 },
          selected: false,
        };
        setNodes((nds) => {
          const updated = [...nds, pasted];
          pushHistory(updated, edges);
          scheduleAutoSave(updated, edges);
          return updated;
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, selectedNode, copiedNode, undo, redo, duplicateNode, edges]);

  // ── Phase 4B: AI Draft — replace canvas with generated definition ────────────

  useEffect(() => {
    if (!draftRequest) return;
    const rfNodes = toRFNodes(draftRequest.definition.nodes ?? []);
    const rfEdges = toRFEdges(draftRequest.definition.connections ?? []);
    const draftGroups = normalizeGroups(draftRequest.definition.ui?.groups);
    const draftBypassers = normalizeFastGroupBypassers(draftRequest.definition.ui?.fastGroupBypassers);
    setNodes(rfNodes);
    setEdges(rfEdges);
    setGroups(draftGroups);
    setFastGroupBypassers(draftBypassers);
    pushHistory(rfNodes, rfEdges);
    scheduleAutoSave(rfNodes, rfEdges, draftGroups, draftBypassers);
    setTimeout(() => fitView({ padding: 0.15 }), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRequest?.stamp]);

  // ── Bulk mode ─────────────────────────────────────────────────────────────

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

  // ── Auto-save (debounced 1.5s) ─────────────────────────────────────────────

  const scheduleAutoSave = useCallback(
    (
      updatedNodes: Node[],
      updatedEdges: Edge[],
      updatedGroups: WorkflowSkillGroup[] = groups,
      updatedFastGroupBypassers: WorkflowFastGroupBypasser[] = fastGroupBypassers,
    ) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const updated: QSWorkflowDefinition = {
          ...definition,
          workflow:    { ...definition.workflow, updatedAt: new Date().toISOString() },
          nodes:       fromRFNodes(updatedNodes),
          connections: fromRFEdges(updatedEdges),
          ui:          {
            ...definition.ui,
            groups: normalizeGroups(updatedGroups),
            fastGroupBypassers: normalizeFastGroupBypassers(updatedFastGroupBypassers),
          },
        };
        onSave(updated);
      }, 1500);
    },
    [definition, fastGroupBypassers, groups, onSave],
  );

  const persistGroups = useCallback(
    (nextGroups: WorkflowSkillGroup[], nextNodes: Node[] = nodes) => {
      const normalized = normalizeGroups(nextGroups);
      setGroups(normalized);
      scheduleAutoSave(nextNodes, edges, normalized, fastGroupBypassers);
    },
    [edges, fastGroupBypassers, nodes, scheduleAutoSave],
  );

  const applyGroupMode = useCallback(
    (groupId: string, mode: SkillMode) => {
      let nextGroups = normalizeGroups(groups).map((group) =>
        group.id === groupId ? { ...group, mode } : group,
      );
      const targetGroup = nextGroups.find((group) => group.id === groupId);

      if (mode === 'active' && targetGroup?.toggleRestriction === 'max-one') {
        nextGroups = nextGroups.map((group) =>
          group.id !== groupId && group.toggleRestriction === 'max-one'
            ? { ...group, mode: 'muted' as SkillMode }
            : group,
        );
      }

      if (
        mode !== 'active' &&
        targetGroup?.toggleRestriction === 'always-one' &&
        nextGroups.filter((group) => group.toggleRestriction === 'always-one' && group.mode === 'active').length === 0
      ) {
        setConnectionError('At least one always-one group must stay active');
        return;
      }

      const modeByNodeId = new Map<string, SkillMode>();
      for (const group of nextGroups) {
        for (const nodeId of group.nodeIds) {
          modeByNodeId.set(nodeId, group.mode ?? 'active');
        }
      }

      setGroups(nextGroups);
      setNodes((nds) => {
        const updated = nds.map((node) =>
          isGroupNode(node) || !modeByNodeId.has(node.id)
            ? node
            : { ...node, data: { ...node.data, mode: modeByNodeId.get(node.id) } },
        );
        scheduleAutoSave(updated, edges, nextGroups, fastGroupBypassers);
        return updated;
      });
    },
    [edges, fastGroupBypassers, groups, scheduleAutoSave, setNodes],
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<WorkflowSkillGroup>) => {
      persistGroups(
        groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
      );
    },
    [groups, persistGroups],
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      const nextGroups = groups.filter((group) => group.id !== groupId);
      setGroups(nextGroups);
      setNodes((nds) => {
        const updated = nds
          .filter((node) => node.id !== groupNodeId(groupId))
          .map((node) => ({ ...node, hidden: false }));
        scheduleAutoSave(updated, edges, nextGroups, fastGroupBypassers);
        return updated;
      });
    },
    [edges, fastGroupBypassers, groups, scheduleAutoSave, setNodes],
  );

  const focusGroup = useCallback(
    (groupId: string) => {
      void fitView({ nodes: [{ id: groupNodeId(groupId) }], padding: 0.18, duration: 300 });
    },
    [fitView],
  );

  const removeFastGroupBypasser = useCallback(
    (bypasserId: string) => {
      const nextBypassers = fastGroupBypassers.filter((bypasser) => bypasser.id !== bypasserId);
      setFastGroupBypassers(nextBypassers);
      setNodes((nds) => {
        const updated = nds.filter((node) => node.id !== fastGroupBypasserNodeId(bypasserId));
        scheduleAutoSave(updated, edges, groups, nextBypassers);
        return updated;
      });
    },
    [edges, fastGroupBypassers, groups, scheduleAutoSave, setNodes],
  );

  const createFastGroupBypasser = useCallback(() => {
    const offset = fastGroupBypassers.length * 28;
    const nextBypasser: WorkflowFastGroupBypasser = {
      id: `fgb_${Date.now().toString(36)}`,
      name: 'Group Mode Switcher',
      position: { x: 120 + offset, y: 120 + offset },
      collapsed: false,
    };
    const nextBypassers = [...fastGroupBypassers, nextBypasser];
    const nextBypasserNode = createFastGroupBypasserNode(nextBypasser, {
      bypasser: nextBypasser,
      groups,
      readOnly,
      onModeChange: applyGroupMode,
      onFocusGroup: focusGroup,
      onRemove: removeFastGroupBypasser,
    });

    setFastGroupBypassers(nextBypassers);
    setNodes((nds) => {
      const updated = [
        ...nds.filter((node) => node.id !== nextBypasserNode.id),
        nextBypasserNode,
      ];
      scheduleAutoSave(updated, edges, groups, nextBypassers);
      return updated;
    });
  }, [
    applyGroupMode,
    edges,
    fastGroupBypassers,
    focusGroup,
    groups,
    readOnly,
    removeFastGroupBypasser,
    scheduleAutoSave,
    setNodes,
  ]);

  const selectedSkillNodes = useMemo(
    () => {
      const selectedIds = new Set(selectedSkillNodeIds);
      return canvasNodesOnly(nodes).filter((node) =>
        selectedIds.size > 0 ? selectedIds.has(node.id) : node.selected,
      );
    },
    [nodes, selectedSkillNodeIds],
  );

  const createGroupFromSelection = useCallback(() => {
    if (selectedSkillNodes.length < 2) return;

    const padding = 40;
    const minX = Math.min(...selectedSkillNodes.map((node) => node.position.x));
    const minY = Math.min(...selectedSkillNodes.map((node) => node.position.y));
    const maxX = Math.max(
      ...selectedSkillNodes.map((node) => node.position.x + (node.width ?? 260)),
    );
    const maxY = Math.max(
      ...selectedSkillNodes.map((node) => node.position.y + (node.height ?? 90)),
    );
    const groupId = `grp_${Date.now().toString(36)}`;
    const nextGroup: WorkflowSkillGroup = {
      id: groupId,
      name: `Group ${groups.length + 1}`,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      nodeIds: selectedSkillNodes.map((node) => node.id as WorkflowSkillGroup['nodeIds'][number]),
      collapsed: false,
      mode: 'active',
      toggleRestriction: 'default',
      bounds: {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(maxX - minX + padding * 2, 260),
        height: Math.max(maxY - minY + padding * 2, 180),
      },
    };
    const nextGroups = [...groups, nextGroup];
    setGroups(nextGroups);
    scheduleAutoSave(nodes, edges, nextGroups);
  }, [edges, groups, nodes, scheduleAutoSave, selectedSkillNodes]);

  useEffect(() => {
    if (readOnly) return;

    function handleGroupShortcut(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod && event.key.toLowerCase() === 'g' && selectedSkillNodes.length >= 2) {
        event.preventDefault();
        createGroupFromSelection();
      }
    }

    window.addEventListener('keydown', handleGroupShortcut);
    return () => window.removeEventListener('keydown', handleGroupShortcut);
  }, [createGroupFromSelection, readOnly, selectedSkillNodes.length]);

  useEffect(() => {
    setNodes((nds) => {
      const nonUtilityNodes = nds.filter((node) => !isCanvasUtilityNode(node));
      const collapsedNodeIds = new Set<string>(
        groups.flatMap((group) => (group.collapsed ? group.nodeIds : [])),
      );
      const nextSkillNodes = nonUtilityNodes.map((node) => ({
        ...node,
        hidden: collapsedNodeIds.has(node.id),
      }));
      const groupNodes = groups.map((group) =>
        createGroupNode(group, {
          group,
          readOnly,
          onRename: (id: string, name: string) => updateGroup(id, { name }),
          onColorChange: (id: string, color: string) => updateGroup(id, { color }),
          onModeChange: applyGroupMode,
          onCollapseChange: (id: string, collapsed: boolean) => updateGroup(id, { collapsed }),
          onRunGroup: workflowId && projectId ? (id: string) => setRunGroupId(id) : undefined,
          onRemove: removeGroup,
        }),
      );
      const bypasserNodes = fastGroupBypassers.map((bypasser) => {
        const existingNode = nds.find((node) => node.id === fastGroupBypasserNodeId(bypasser.id));
        const visualBypasser = existingNode
          ? { ...bypasser, position: existingNode.position }
          : bypasser;

        return createFastGroupBypasserNode(visualBypasser, {
          bypasser: visualBypasser,
          groups,
          readOnly,
          onModeChange: applyGroupMode,
          onFocusGroup: focusGroup,
          onRemove: removeFastGroupBypasser,
        });
      });
      return [...groupNodes, ...bypasserNodes, ...nextSkillNodes];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyGroupMode, fastGroupBypassers, groups, readOnly, removeFastGroupBypasser, removeGroup, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedGroupIds = new Set(
        changes.flatMap((change) =>
          change.type === 'remove' && 'id' in change && change.id.startsWith(GROUP_NODE_PREFIX)
            ? [groupIdFromNodeId(change.id)]
            : [],
        ),
      );
      const removedFastGroupBypasserIds = new Set(
        changes.flatMap((change) =>
          change.type === 'remove' && 'id' in change && change.id.startsWith(FAST_GROUP_BYPASSER_PREFIX)
            ? [fastGroupBypasserIdFromNodeId(change.id)]
            : [],
        ),
      );
      const shouldPersistLayout = changes.some(
        (change) => change.type !== 'select' && !isLiveNodeDragChange(change),
      );
      if (!shouldPersistLayout) {
        onNodesChange(changes);
        return;
      }

      const updatedNodes = applyNodeChanges(changes, nodes);
      const activeGroups = groups.filter((group) => !removedGroupIds.has(group.id));
      const activeFastGroupBypassers = fastGroupBypassers.filter(
        (bypasser) => !removedFastGroupBypasserIds.has(bypasser.id),
      );
      const nextGroups = activeGroups.map((group) => {
        const node = updatedNodes.find((candidate) => candidate.id === groupNodeId(group.id));
        return node ? { ...group, bounds: groupBoundsFromNode(node, group) } : group;
      });
      const nextFastGroupBypassers = activeFastGroupBypassers.map((bypasser) => {
        const node = updatedNodes.find((candidate) => candidate.id === fastGroupBypasserNodeId(bypasser.id));
        return node ? { ...bypasser, position: node.position } : bypasser;
      });

      if (
        nextGroups.length !== groups.length ||
        nextGroups.some((group, index) => !sameGroupBounds(group.bounds, groups[index]?.bounds))
      ) {
        setGroups(nextGroups);
      }
      if (
        nextFastGroupBypassers.length !== fastGroupBypassers.length ||
        nextFastGroupBypassers.some((bypasser, index) => !samePosition(bypasser.position, fastGroupBypassers[index]?.position))
      ) {
        setFastGroupBypassers(nextFastGroupBypassers);
      }

      onNodesChange(changes);
      scheduleAutoSave(updatedNodes, edges, nextGroups, nextFastGroupBypassers);
    },
    [edges, fastGroupBypassers, groups, nodes, onNodesChange, scheduleAutoSave],
  );

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const nextSelectedIds = canvasNodesOnly(selectedNodes).map((node) => node.id);
    setSelectedSkillNodeIds((previousIds) =>
      sameStringArray(previousIds, nextSelectedIds) ? previousIds : nextSelectedIds,
    );
    setStoreSelectedNodeId(nextSelectedIds[0] ?? null);
  }, [setStoreSelectedNodeId]);

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setEdges((eds) => { scheduleAutoSave(nodes, eds); return eds; });
    },
    [onEdgesChange, setEdges, nodes, scheduleAutoSave],
  );

  // ── Connect ────────────────────────────────────────────────────────────────

  const showConnectionError = useCallback((message: string) => {
    setConnectionError(message);
    if (connectionErrorTimerRef.current) clearTimeout(connectionErrorTimerRef.current);
    connectionErrorTimerRef.current = setTimeout(() => setConnectionError(null), 2200);
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      const { source, sourceHandle, target, targetHandle } = connection;

      if (!source || !target || source === target) {
        lastConnectionValidRef.current = false;
        return false;
      }

      const normalizedSourceHandle = sourceHandle ?? 'out';
      const normalizedTargetHandle = targetHandle ?? 'in';
      const alreadyConnected = edges.some(
        (edge) =>
          edge.source === source &&
          (edge.sourceHandle ?? 'out') === normalizedSourceHandle &&
          edge.target === target &&
          (edge.targetHandle ?? 'in') === normalizedTargetHandle,
      );

      if (alreadyConnected) {
        lastConnectionValidRef.current = false;
        return false;
      }

      const sourceType = portTypeMap.get(source)?.get(normalizedSourceHandle);
      const targetType = portTypeMap.get(target)?.get(normalizedTargetHandle);
      const isValid = isPortCompatible(sourceType, targetType);
      lastConnectionValidRef.current = isValid;
      return isValid;
    },
    [edges, portTypeMap],
  );

  const onConnectStart = useCallback(() => {
    lastConnectionValidRef.current = true;
    setConnectionError(null);
  }, []);

  const onConnectEnd = useCallback(() => {
    if (!lastConnectionValidRef.current) {
      showConnectionError('Incompatible port types or duplicate connection');
    }
  }, [showConnectionError]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) {
        showConnectionError('Incompatible port types or duplicate connection');
        return;
      }

      setEdges((eds) => {
        const updated = addEdge({ ...params, id: `e-${Date.now()}` }, eds);
        pushHistory(nodes, updated);
        scheduleAutoSave(nodes, updated);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setEdges, nodes, scheduleAutoSave, isValidConnection, showConnectionError],
  );

  // ── Delete node ────────────────────────────────────────────────────────────

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      let updatedEdges: Edge[] = [];
      setEdges((eds) => {
        updatedEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        return updatedEdges;
      });
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== nodeId);
        pushHistory(updated, updatedEdges);
        scheduleAutoSave(updated, updatedEdges);
        return updated;
      });
      setSelectedNode(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNodes, setEdges, scheduleAutoSave],
  );

  // ── Config change ──────────────────────────────────────────────────────────

  const handleConfigChange = useCallback(
    (nodeId: string, newConfig: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, config: newConfig } } : n,
        ),
      );
    },
    [setNodes],
  );

  // ── Label change ───────────────────────────────────────────────────────────

  const handleLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
        );
        scheduleAutoSave(updated, edges);
        return updated;
      });
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, label } } : prev,
      );
    },
    [setNodes, scheduleAutoSave, edges],
  );

  // ── Skill mode ────────────────────────────────────────────────────────────

  const handleSetMode = useCallback(
    (nodeId: string, mode: SkillMode) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, mode } } : n,
        );
        scheduleAutoSave(updated, edges);
        return updated;
      });
      setContextMenu(null);
    },
    [setNodes, scheduleAutoSave, edges],
  );

  // ── Context menu ──────────────────────────────────────────────────────────

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (isCanvasUtilityNode(node)) return;
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  // ── Drag-and-drop from palette ─────────────────────────────────────────────

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isGroupNode(node)) {
        const groupId = node.id.replace(GROUP_NODE_PREFIX, '');
        const group = groups.find((candidate) => candidate.id === groupId);
        if (!group) return;
        updateGroup(groupId, { bounds: groupBoundsFromNode(node, group) });
        return;
      }
      if (isCanvasUtilityNode(node)) return;

      const nodeWidth = node.width ?? 260;
      const nodeHeight = node.height ?? 90;
      const center = {
        x: node.position.x + nodeWidth / 2,
        y: node.position.y + nodeHeight / 2,
      };
      const containingGroup = groups.find((group) => {
        if (group.collapsed) return false;
        const { x, y, width, height } = group.bounds;
        return center.x >= x && center.x <= x + width && center.y >= y && center.y <= y + height;
      });

      const nextGroups = groups.map((group) => {
        const withoutNode = group.nodeIds.filter((nodeId) => nodeId !== node.id);
        return group.id === containingGroup?.id
          ? { ...group, nodeIds: [...withoutNode, node.id as WorkflowSkillGroup['nodeIds'][number]] }
          : { ...group, nodeIds: withoutNode };
      });

      persistGroups(nextGroups);
    },
    [groups, persistGroups, updateGroup],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType  = event.dataTransfer.getData('application/lados-node-type');
      const nodeLabel = event.dataTransfer.getData('application/lados-node-label');
      const nodeIcon  = event.dataTransfer.getData('application/lados-node-icon');
      const nodeColor = event.dataTransfer.getData('application/lados-node-color');
      const nodeCat   = event.dataTransfer.getData('application/lados-node-category');
      if (!nodeType) return;
      const nodeDef = nodeRegistry.get(nodeType);

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 20,
      };

      const newNode: Node = {
        id:       `${nodeType}-${Date.now()}`,
        type:     rfNodeType(nodeType),
        position,
        data:     {
          label:    nodeLabel || nodeType,
          nodeType,
          config:   {},
          mode:     'active',
          icon:     nodeIcon  || undefined,
          color:    nodeColor || undefined,
          category: nodeCat   || undefined,
          inputs:   nodeDef?.inputs ?? [],
          outputs:  nodeDef?.outputs ?? [],
        },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        pushHistory(updated, edges);
        scheduleAutoSave(updated, edges);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNodes, edges, scheduleAutoSave, nodeRegistry],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedSkillNodeIds([]);
    setContextMenu(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warnCount  = validationErrors.filter((e) => e.severity === 'warning').length;
  const firstMsg   = validationErrors[0]?.message ?? '';
  const runGroup = runGroupId ? groups.find((group) => group.id === runGroupId) : undefined;

  return (
    <div className="relative flex h-full w-full">
      {/* Canvas area */}
      <div
        className="flex-1 relative"
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
      >
        {/* Validation banner */}
        {!readOnly && validationErrors.length > 0 && (
          <div
            className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b ${
              errorCount > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <span>{errorCount > 0 ? '⛔' : '⚠️'}</span>
            <span className="font-semibold">
              {errorCount > 0
                ? `${errorCount} connection error${errorCount > 1 ? 's' : ''} — Run disabled`
                : `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
            </span>
            <span className="opacity-60 truncate">
              {firstMsg}
              {validationErrors.length > 1 && ` (+${validationErrors.length - 1} more)`}
            </span>
          </div>
        )}

        {!readOnly && connectionError && validationErrors.length === 0 && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <span>Blocked</span>
            <span className="truncate opacity-80">{connectionError}</span>
          </div>
        )}

        {/* Canvas overlay toolbar (top-right) */}
        {!readOnly && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <button
              onClick={createGroupFromSelection}
              disabled={selectedSkillNodes.length < 2}
              title="Group selected skills (G)"
              className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm leading-none"
            >
              Group
            </button>
            <button
              onClick={createFastGroupBypasser}
              title="Add Group Mode Switcher"
              className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm leading-none"
            >
              Group Switcher
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm leading-none"
            >
              ↩
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm leading-none"
            >
              ↪
            </button>
            <button
              onClick={() => fitView({ padding: 0.12, duration: 300 })}
              title="Fit to view"
              className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm leading-none"
            >
              ⊞
            </button>
            <button
              onClick={() => setShowMinimap((s) => !s)}
              title={showMinimap ? 'Hide minimap' : 'Show minimap'}
              className={`p-1.5 rounded text-sm border shadow-sm leading-none ${
                showMinimap
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
              }`}
            >
              🗺
            </button>
            {selectedNode && (
              <button
                onClick={() => duplicateNode(selectedNode)}
                title="Duplicate node (Ctrl+D)"
                className="p-1.5 rounded text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm leading-none"
              >
                ⧉
              </button>
            )}
            {copiedNode && (
              <span className="text-[10px] text-gray-400 px-1.5 py-1 bg-white border border-gray-200 rounded shadow-sm">
                📋 Ctrl+V to paste
              </span>
            )}
          </div>
        )}

        <ReactFlow
          nodeTypes={reactFlowNodeTypes}
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          isValidConnection={readOnly ? undefined : isValidConnection}
          onConnectStart={readOnly ? undefined : onConnectStart}
          onConnectEnd={readOnly ? undefined : onConnectEnd}
          onNodeClick={(_, node) => {
            setSelectedNode(isCanvasUtilityNode(node) ? null : node);
            setContextMenu(null);
          }}
          onSelectionChange={handleSelectionChange}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
          onNodeDragStop={readOnly ? undefined : onNodeDragStop}
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          fitView
          attributionPosition="bottom-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          {showMinimap && (
            <MiniMap
              nodeColor={(n) => {
                const mode = (n.data as { mode?: SkillMode }).mode ?? 'active';
                return mode === 'muted' ? '#d1d5db' : mode === 'bypassed' ? '#fbbf24' : '#3b82f6';
              }}
              maskColor="rgba(0,0,0,0.08)"
              style={{ border: '1px solid #e5e7eb' }}
            />
          )}
        </ReactFlow>
      </div>

      {/* Skill Inspector (PropertyPanel) */}
      <PropertyPanel
        selectedNode={selectedNode}
        onConfigChange={handleConfigChange}
        onLabelChange={readOnly ? undefined : handleLabelChange}
        onDeleteNode={readOnly ? undefined : handleDeleteNode}
        organizationId={organizationId}
        projectId={projectId}
        workflowId={workflowId}
      />

      {/* Skill mode context menu */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          className="rounded-lg border border-gray-200 bg-white shadow-xl py-1 min-w-[160px]"
          onMouseLeave={() => setContextMenu(null)}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
            Skill Mode
          </p>
          {MODE_OPTIONS.map(({ mode, icon, label, desc }) => {
            const currentMode =
              (nodes.find((n) => n.id === contextMenu.nodeId)?.data as { mode?: SkillMode })
                ?.mode ?? 'active';
            const isCurrentMode = currentMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleSetMode(contextMenu.nodeId, mode)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors ${
                  isCurrentMode ? 'font-semibold text-blue-600' : 'text-gray-700'
                }`}
              >
                <span className="w-5 text-center flex-shrink-0">{icon}</span>
                <span className="flex-1">
                  {label}
                  <span className="ml-1 text-[10px] text-gray-400 font-normal">— {desc}</span>
                </span>
                {isCurrentMode && <span className="text-blue-400 text-[11px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {runGroup && projectId && workflowId && (
        <RunGroupModal
          projectId={projectId}
          workflowId={workflowId}
          group={runGroup}
          onClose={() => setRunGroupId(null)}
          onCompleted={() => onGroupRunCompleted?.()}
        />
      )}
    </div>
  );
}
