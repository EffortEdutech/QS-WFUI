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
  useNodesState,
  useEdgesState,
  useReactFlow,
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
} from '@lados/shared-types';
import { apiClient } from '@/lib/api/client';
import PropertyPanel from './PropertyPanel';
import { ConditionNode } from './ConditionNode';

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

  return (
    <div
      className={`relative rounded px-3 py-2 text-xs font-medium min-w-[130px] shadow-sm transition-all ${containerCls}`}
      style={accentStyle}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#9ca3af', width: 8, height: 8 }}
      />

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

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9ca3af', width: 8, height: 8 }}
      />
    </div>
  );
}

// Stable module-level constant — prevents React Flow nodeTypes warning
const NODE_TYPES: NodeTypes = {
  skill:     SkillNode,
  condition: ConditionNode,
};

// ── Helpers: convert QS-OS types ↔ React Flow types ──────────────────────────

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
  return rfNodes.map((n) => ({
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
  label: string;
  type: string;
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
  const seen    = new Map<string, true>();   // source→target dedup

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
    const pairKey = `${edge.source}→${edge.target}`;
    if (seen.has(pairKey)) {
      errors.push({
        edgeId:   edge.id,
        message:  `Duplicate: "${src.data.label as string}" → "${tgt.data.label as string}"`,
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
  bulkModeRequest?:    BulkModeRequest | null;
  draftRequest?:       DraftRequest | null;
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
  bulkModeRequest,
  draftRequest,
  onValidationChange,
}: WorkflowCanvasProps) {
  const { fitView } = useReactFlow();

  // ── Core canvas state ──────────────────────────────────────────────────────

  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(definition.nodes ?? []));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(definition.connections ?? []));
  const [selectedNode, setSelectedNode]   = useState<Node | null>(null);
  const [contextMenu, setContextMenu]     = useState<ContextMenuState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const validationErrors = useMemo(
    () => computeValidation(nodes, edges, nodeRegistry),
    [nodes, edges, nodeRegistry],
  );

  const hasErrors = validationErrors.some((e) => e.severity === 'error');

  useEffect(() => {
    onValidationChange?.(hasErrors);
  }, [hasErrors, onValidationChange]);

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
    setNodes(rfNodes);
    setEdges(rfEdges);
    pushHistory(rfNodes, rfEdges);
    scheduleAutoSave(rfNodes, rfEdges);
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
    (updatedNodes: Node[], updatedEdges: Edge[]) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const updated: QSWorkflowDefinition = {
          ...definition,
          workflow:    { ...definition.workflow, updatedAt: new Date().toISOString() },
          nodes:       fromRFNodes(updatedNodes),
          connections: fromRFEdges(updatedEdges),
        };
        onSave(updated);
      }, 1500);
    },
    [definition, onSave],
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      setNodes((nds) => { scheduleAutoSave(nds, edges); return nds; });
    },
    [onNodesChange, setNodes, edges, scheduleAutoSave],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setEdges((eds) => { scheduleAutoSave(nodes, eds); return eds; });
    },
    [onEdgesChange, setEdges, nodes, scheduleAutoSave],
  );

  // ── Connect ────────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const updated = addEdge({ ...params, id: `e-${Date.now()}` }, eds);
        pushHistory(nodes, updated);
        scheduleAutoSave(nodes, updated);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setEdges, nodes, scheduleAutoSave],
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
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  // ── Drag-and-drop from palette ─────────────────────────────────────────────

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType  = event.dataTransfer.getData('application/lados-node-type');
      const nodeLabel = event.dataTransfer.getData('application/lados-node-label');
      const nodeIcon  = event.dataTransfer.getData('application/lados-node-icon');
      const nodeColor = event.dataTransfer.getData('application/lados-node-color');
      const nodeCat   = event.dataTransfer.getData('application/lados-node-category');
      if (!nodeType) return;

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
    [setNodes, edges, scheduleAutoSave],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warnCount  = validationErrors.filter((e) => e.severity === 'warning').length;
  const firstMsg   = validationErrors[0]?.message ?? '';

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

        {/* Canvas overlay toolbar (top-right) */}
        {!readOnly && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
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
          nodeTypes={NODE_TYPES}
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={(_, node) => {
            setSelectedNode(node);
            setContextMenu(null);
          }}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
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
    </div>
  );
}
