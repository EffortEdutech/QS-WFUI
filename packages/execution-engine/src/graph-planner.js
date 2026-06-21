"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planWorkflow = planWorkflow;
function buildAdjacency(nodes, connections) {
    const adj = new Map();
    for (const n of nodes)
        adj.set(n.id, new Set());
    for (const conn of connections) {
        const deps = adj.get(conn.targetNodeId);
        if (deps)
            deps.add(conn.sourceNodeId);
    }
    return adj;
}
function kahnSort(nodes, adj) {
    const inDegree = new Map();
    for (const n of nodes)
        inDegree.set(n.id, 0);
    for (const [, deps] of adj) {
        for (const dep of deps) {
        }
    }
    for (const [nodeId, deps] of adj) {
        inDegree.set(nodeId, deps.size);
    }
    const successors = new Map();
    for (const n of nodes)
        successors.set(n.id, new Set());
    for (const [nodeId, deps] of adj) {
        for (const dep of deps) {
            successors.get(dep)?.add(nodeId);
        }
    }
    const queue = [];
    for (const [nodeId, deg] of inDegree) {
        if (deg === 0)
            queue.push(nodeId);
    }
    const order = [];
    while (queue.length > 0) {
        const current = queue.shift();
        order.push(current);
        for (const successor of successors.get(current) ?? []) {
            const newDeg = (inDegree.get(successor) ?? 1) - 1;
            inDegree.set(successor, newDeg);
            if (newDeg === 0)
                queue.push(successor);
        }
    }
    const inOrder = new Set(order);
    const cycleNodes = nodes.map((n) => n.id).filter((id) => !inOrder.has(id));
    const cycles = cycleNodes.length > 0 ? [cycleNodes] : [];
    return { order, cycles };
}
function planWorkflow(definition) {
    const { nodes, connections } = definition;
    if (!nodes || nodes.length === 0) {
        return { steps: [], cycles: [] };
    }
    const adj = buildAdjacency(nodes, connections ?? []);
    const { order, cycles } = kahnSort(nodes, adj);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const steps = order.map((nodeId) => {
        const node = nodeMap.get(nodeId);
        return {
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            config: node.config ?? {},
            dependsOn: Array.from(adj.get(nodeId) ?? []),
        };
    });
    return { steps, cycles };
}
//# sourceMappingURL=graph-planner.js.map