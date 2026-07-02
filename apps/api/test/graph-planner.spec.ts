/**
 * PD-2 — Execution engine graph planner tests.
 * Covers: topological order, parallel grouping (BFS levels), cycle detection,
 * empty definitions, and skip-relevant node modes surviving planning.
 */
import { planWorkflow } from '@lados/execution-engine';

type AnyDef = Parameters<typeof planWorkflow>[0];

function def(nodes: Array<{ id: string; type: string; mode?: string }>, connections: Array<[string, string]>): AnyDef {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.id, config: {}, mode: n.mode })),
    connections: connections.map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId })),
  } as unknown as AnyDef;
}

describe('planWorkflow', () => {
  it('returns an empty plan for an empty definition', () => {
    const plan = planWorkflow({ nodes: [], connections: [] } as unknown as AnyDef);
    expect(plan.steps).toHaveLength(0);
    expect(plan.parallelGroups).toHaveLength(0);
    expect(plan.cycles).toHaveLength(0);
  });

  it('orders a linear chain topologically', () => {
    const plan = planWorkflow(def(
      [{ id: 'a', type: 'core.start' }, { id: 'b', type: 'core.task' }, { id: 'c', type: 'core.end' }],
      [['a', 'b'], ['b', 'c']],
    ));
    expect(plan.steps.map((s) => s.nodeId)).toEqual(['a', 'b', 'c']);
    expect(plan.cycles).toHaveLength(0);
  });

  it('respects dependsOn for each step', () => {
    const plan = planWorkflow(def(
      [{ id: 'a', type: 't' }, { id: 'b', type: 't' }, { id: 'c', type: 't' }],
      [['a', 'c'], ['b', 'c']],
    ));
    const stepC = plan.steps.find((s) => s.nodeId === 'c')!;
    expect(new Set(stepC.dependsOn)).toEqual(new Set(['a', 'b']));
  });

  it('buckets independent nodes into the same parallel group (BFS level)', () => {
    // a → c, b → c : a and b are level 0 (parallel), c is level 1
    const plan = planWorkflow(def(
      [{ id: 'a', type: 't' }, { id: 'b', type: 't' }, { id: 'c', type: 't' }],
      [['a', 'c'], ['b', 'c']],
    ));
    expect(plan.parallelGroups).toHaveLength(2);
    expect(new Set(plan.parallelGroups[0].map((s) => s.nodeId))).toEqual(new Set(['a', 'b']));
    expect(plan.parallelGroups[1].map((s) => s.nodeId)).toEqual(['c']);
  });

  it('assigns level = max(predecessor levels) + 1 for diamond graphs', () => {
    // a → b → d, a → c → d, plus a → d shortcut: d must still be level 2
    const plan = planWorkflow(def(
      [{ id: 'a', type: 't' }, { id: 'b', type: 't' }, { id: 'c', type: 't' }, { id: 'd', type: 't' }],
      [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['a', 'd']],
    ));
    const levels = new Map(plan.steps.map((s) => [s.nodeId, s.level]));
    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(1);
    expect(levels.get('c')).toBe(1);
    expect(levels.get('d')).toBe(2);
  });

  it('detects cycles and reports the offending nodes', () => {
    const plan = planWorkflow(def(
      [{ id: 'a', type: 't' }, { id: 'b', type: 't' }, { id: 'c', type: 't' }],
      [['a', 'b'], ['b', 'c'], ['c', 'b']], // b ↔ c cycle
    ));
    expect(plan.cycles).toHaveLength(1);
    expect(new Set(plan.cycles[0])).toEqual(new Set(['b', 'c']));
    // acyclic prefix is still planned
    expect(plan.steps.map((s) => s.nodeId)).toEqual(['a']);
  });

  it('preserves node mode (mute/bypass) through planning', () => {
    const plan = planWorkflow(def(
      [{ id: 'a', type: 't', mode: 'mute' }, { id: 'b', type: 't' }],
      [['a', 'b']],
    ));
    expect(plan.steps.find((s) => s.nodeId === 'a')!.mode).toBe('mute');
    expect(plan.steps.find((s) => s.nodeId === 'b')!.mode).toBe('active');
  });
});
