/**
 * core.parallel — Phase 6
 *
 * Fan-out marker node for explicit parallel branch documentation on the canvas.
 *
 * In practice, the execution runner's level-based scheduling already runs all
 * topologically-independent nodes in parallel. This node serves two purposes:
 *   1. Canvas UX — explicitly marks where a workflow splits into parallel branches.
 *   2. Metadata enrichment — downstream nodes can inspect `parallel_start` in
 *      upstream outputs to know they are on a parallel branch.
 *
 * Inputs  : any (passes through everything)
 * Config  :
 *   branch_count — expected number of parallel branches (informational only, default: 2)
 *   label        — optional human label for this parallel group
 * Outputs :
 *   parallel_start — true (marker for downstream merge node)
 *   branch_count   — as configured
 *   inputs         — the resolved inputs object (fan-out data)
 *   started_at     — ISO timestamp
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';

export async function realParallel(ctx: NodeContext): Promise<NodeExecuteResult> {
  const branchCount = (ctx.config['branch_count'] as number | undefined) ?? 2;
  const label       = (ctx.config['label']        as string | undefined) ?? 'parallel';

  ctx.logger.info(`[core.parallel] "${label}": starting ${branchCount} parallel branches`);

  return {
    status: 'success',
    outputs: {
      parallel_start: true,
      branch_count:   branchCount,
      inputs:         ctx.inputs,
      started_at:     new Date().toISOString(),
    },
  };
}
