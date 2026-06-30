/**
 * @lados/execution-engine — Graph Planner
 *
 * Converts a QSWorkflowDefinition into a topologically-sorted ExecutionPlan.
 * Detects cycles and validates that every node type is referenced correctly.
 */

import type { QSWorkflowDefinition, WorkflowNodeInstance, NodeInstanceId } from '@lados/shared-types';
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
//
// Phase 6 addition: track BFS level (wave) for each node.
// All nodes at the same level can execute in parallel — they have no
// inter-dependencies on each other.

function kahnSort(
  nodes: WorkflowNodeInstance[],
  adj: Map<string, Set<string>>,
): { order: string[]; levels: Map<string, number>; cycles: string[][] } {
  // adj[nodeId] = set of nodes that must come BEFORE nodeId (its dependencies)
  // Re-build in-degree from adj
  const inDegree = new Map<string, number>();
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

  // BFS with level tracking
  // Initialize: all root nodes (no dependencies) are at level 0
  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) {
      queue.push(nodeId);
      levels.set(nodeId, 0);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const currentLevel = levels.get(current) ?? 0;

    for (const successor of successors.get(current) ?? []) {
      const newDeg = (inDegree.get(successor) ?? 1) - 1;
      inDegree.set(successor, newDeg);

      // A node's level is max(level of all predecessors) + 1
      const prevLevel = levels.get(successor) ?? 0;
      levels.set(successor, Math.max(prevLevel, currentLevel + 1));

      if (newDeg === 0) queue.push(successor);
    }
  }

  // Any node not in order is part of a cycle
  const inOrder = new Set(order);
  const cycleNodes = nodes.map((n) => n.id).filter((id) => !inOrder.has(id));
  const cycles: string[][] = cycleNodes.length > 0 ? [cycleNodes] : [];

  return { order, levels, cycles };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function planWorkflow(definition: QSWorkflowDefinition): ExecutionPlan {
  const { nodes, connections } = definition;

  if (!nodes || nodes.length === 0) {
    return { steps: [], parallelGroups: [], cycles: [] };
  }

  const adj = buildAdjacency(nodes, connections ?? []);
  const { order, levels, cycles } = kahnSort(nodes, adj);

  // Build node lookup for fast access
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const steps: ExecutionStep[] = order.map((nodeId) => {
    const node = nodeMap.get(nodeId as NodeInstanceId)!;
    return {
      nodeId:    node.id,
      nodeType:  node.type,
      nodeLabel: node.label ?? node.type,
      config:    (node.config as Record<string, unknown>) ?? {},
      dependsOn: Array.from(adj.get(nodeId) ?? []),
      level:     levels.get(nodeId) ?? 0,
    };
  });

  // Build parallelGroups: bucket steps by level, sorted by level ascending
  const groupMap = new Map<number, ExecutionStep[]>();
  for (const step of steps) {
    const bucket = groupMap.get(step.level) ?? [];
    bucket.push(step);
    groupMap.set(step.level, bucket);
  }
  const maxLevel = steps.length > 0 ? Math.max(...steps.map((s) => s.level)) : -1;
  const parallelGroups: ExecutionStep[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    parallelGroups.push(groupMap.get(i) ?? []);
  }

  return { steps, parallelGroups, cycles };
}
