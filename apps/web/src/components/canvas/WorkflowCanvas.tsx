'use client';

import { useCallback, useRef, useState } from 'react';
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
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { QSWorkflowDefinition, WorkflowNodeInstance, WorkflowConnection } from '@qsos/shared-types';
import PropertyPanel from './PropertyPanel';

// ── Helpers: convert QS-OS types ↔ React Flow types ─────────────────────────

function toRFNodes(nodes: WorkflowNodeInstance[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: 'default',
    position: n.position,
    data: { label: n.label ?? n.type, nodeType: n.type, config: n.config ?? {} },
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

// ── Component ─────────────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  definition: QSWorkflowDefinition;
  onSave?: (updated: QSWorkflowDefinition) => void;
  readOnly?: boolean;
  organizationId?: string;
  projectId?: string;
}

export default function WorkflowCanvas({
  definition,
  onSave,
  readOnly = false,
  organizationId,
  projectId,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(definition.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(definition.connections));
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, id: `e-${Date.now()}` }, eds));
    },
    [setEdges],
  );

  /** Debounced auto-save — fires 1.5s after last canvas change */
  const scheduleAutoSave = useCallback(
    (updatedNodes: Node[], updatedEdges: Edge[]) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const updated: QSWorkflowDefinition = {
          ...definition,
          workflow: { ...definition.workflow, updatedAt: new Date().toISOString() },
          nodes: fromRFNodes(updatedNodes),
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
      setNodes((nds) => {
        scheduleAutoSave(nds, edges);
        return nds;
      });
    },
    [onNodesChange, setNodes, edges, scheduleAutoSave],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setEdges((eds) => {
        scheduleAutoSave(nodes, eds);
        return eds;
      });
    },
    [onEdgesChange, setEdges, nodes, scheduleAutoSave],
  );

  /** Delete the currently selected node (called from PropertyPanel or keyboard) */
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== nodeId);
        scheduleAutoSave(updated, edges);
        return updated;
      });
      setEdges((eds) => {
        const updated = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        scheduleAutoSave(nodes.filter((n) => n.id !== nodeId), updated);
        return updated;
      });
      setSelectedNode(null);
    },
    [setNodes, setEdges, scheduleAutoSave, edges, nodes],
  );

  /** Update a node's config from the property panel */
  const handleConfigChange = useCallback(
    (nodeId: string, newConfig: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: newConfig } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  /** Drop a node from the palette onto the canvas */
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/qsos-node-type');
      const nodeLabel = event.dataTransfer.getData('application/qsos-node-label');
      if (!nodeType) return;

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 20,
      };

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: 'default',
        position,
        data: { label: nodeLabel || nodeType, nodeType, config: {} },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="flex h-full w-full">
      {/* Canvas */}
      <div
        className="flex-1"
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={(_, node) => setSelectedNode(node)}
          onPaneClick={() => setSelectedNode(null)}
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          fitView
          attributionPosition="bottom-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(0,0,0,0.08)"
            style={{ border: '1px solid #e5e7eb' }}
          />
        </ReactFlow>
      </div>

      {/* Property panel */}
      <PropertyPanel
        selectedNode={selectedNode}
        onConfigChange={handleConfigChange}
        onDeleteNode={readOnly ? undefined : handleDeleteNode}
        organizationId={organizationId}
        projectId={projectId}
      />
    </div>
  );
}
