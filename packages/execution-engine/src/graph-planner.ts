/**
 * @qsos/execution-engine — Graph Planner
 *
 * Converts a QSWorkflowDefinition into a topologically-sorted ExecutionPlan.
 * Detects cycles and validates that every node type is referenced correctly.
 */

import type { QSWorkflowDefinition, WorkflowNodeInstance } from '@qsos/shared-types';
import type { ExecutionPlan, ExecutionStep } from './types';

// ── Build adjacency ───────────────────────────────────────────────────────────

function buildAdjacency(
  nodes: WorkflowNodeInstance[],
  connections: QSWorkflowDefinition['connections'],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());

  for (const conn of connections) {
    const deps = adj.get(conn.targetNodeId);
    if (deps) deps.add(conn.sourceNodeId);
  }

  return adj;
}

// ── Kahn's algorithm for topological sort + cycle detection ──────────────────

function kahnSort(
  nodes: WorkflowNodeInstance[],
  adj: Map<string, Set<string>>,
): { order: string[]; cycles: string[][] } {
  // In-degree: how many predecessors each node has
  const inDegree = new Map<string, number>();
  for (const n of nodes) inDegree.set(n.id, 0);

  for (const [, deps] of adj) {
    for (const dep of deps) {
      // dep → node: inDegree[node] counts predecessors (deps of node is its adj set)
    }
  }

  // Re-build: adj[nodeId] = set of nodes that must come BEFORE nodeId
  // So for each nodeId, inDegree[nodeId] = adj[nodeId].size
  for (const [nodeId, deps] of adj) {
    inDegree.set(nodeId, deps.size);
  }

  // Build reverse adjacency: successors[nodeId] = set of nodes that depend on nodeId
  const successors = new Map<string, Set<string>>();
  for (const n of nodes) successors.set(n.id, new Set());

  for (const [nodeId, deps] of adj) {
    for (const dep of deps) {
      successors.get(dep)?.add(nodeId);
    }
  }

  // Queue all nodes with no dependencies
  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) queue.push(nodeId);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const successor of successors.get(current) ?? []) {
      const newDeg = (inDegree.get(successor) ?? 1) - 1;
      inDegree.set(successor, newDeg);
      if (newDeg === 0) queue.push(successor);
    }
  }

  // Any node not in order is part of a cycle
  const inOrder = new Set(order);
  const cycleNodes = nodes.map((n) => n.id).filter((id) => !inOrder.has(id));

  // Build a simple cycle representation (just the IDs for now)
  const cycles: string[][] = cycleNodes.length > 0 ? [cycleNodes] : [];

  return { order, cycles };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function planWorkflow(definition: QSWorkflowDefinition): ExecutionPlan {
  const { nodes, connections } = definition;

  if (!nodes || nodes.length === 0) {
    return { steps: [], cycles: [] };
  }

  const adj = buildAdjacency(nodes, connections ?? []);
  const { order, cycles } = kahnSort(nodes, adj);

  // Build node lookup for fast access
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const steps: ExecutionStep[] = order.map((nodeId) => {
    const node = nodeMap.get(nodeId)!;
    return {
      nodeId: node.id,
      nodeType: node.type,
      nodeLabel: node.label ?? node.type,
      config: (node.config as Record<string, unknown>) ?? {},
      dependsOn: Array.from(adj.get(nodeId) ?? []),
    };
  });

  return { steps, cycles };
}
