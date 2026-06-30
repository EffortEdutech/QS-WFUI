/**
 * core.merge — Phase 6
 *
 * Fan-in marker node. Waits for all parallel branches to complete (handled
 * automatically by the level-based runner — this node sits at the next level
 * after all branch nodes, so it only executes once all of them have finished).
 *
 * Merges all upstream node outputs into a single flat object, plus provides a
 * structured `branches` map keyed by node ID.
 *
 * Inputs  : receives merged outputs of all upstream nodes via ctx.upstream
 * Config  :
 *   merge_strategy — 'shallow' (default): Object.assign left-to-right
 *                    'deep': deep merge (preserves nested keys from all branches)
 *   label          — optional human label for this merge point
 * Outputs :
 *   merged         — flat merged object from all upstream outputs
 *   branches       — { [nodeId]: outputs } map for branch-specific access
 *   branch_count   — number of branches merged
 *   completed_at   — ISO timestamp
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';

// Simple deep merge: later values win on conflict for scalars; arrays are replaced.
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function realMerge(ctx: NodeContext): Promise<NodeExecuteResult> {
  const strategy = (ctx.config['merge_strategy'] as string | undefined) ?? 'shallow';
  const label    = (ctx.config['label']          as string | undefined) ?? 'merge';

  const upstream = ctx.upstream ?? {};
  const branchIds = Object.keys(upstream);

  let merged: Record<string, unknown> = {};

  for (const nodeId of branchIds) {
    const branchOutput = upstream[nodeId] ?? {};
    if (strategy === 'deep') {
      merged = deepMerge(merged, branchOutput);
    } else {
      Object.assign(merged, branchOutput);
    }
  }

  ctx.logger.info(
    `[core.merge] "${label}": merged ${branchIds.length} branch(es) ` +
    `using "${strategy}" strategy`,
  );

  return {
    status: 'success',
    outputs: {
      merged,
      branches:     upstream,
      branch_count: branchIds.length,
      completed_at: new Date().toISOString(),
    },
  };
}
