/**
 * core.loop — Phase 6
 *
 * Iterates over an array of items, optionally extracting a sub-key from each
 * item, and produces a results array along with aggregate metadata.
 *
 * Inputs (from upstream or workflow inputs):
 *   items  — the array to iterate. If not found, uses config.items.
 *
 * Config:
 *   items_key   — key in upstream outputs to read the array from (default: 'items')
 *   extract_key — optional: if set, map each item to item[extract_key]
 *   label       — optional human label for the loop (shown in logs)
 *
 * Outputs:
 *   results   — processed array (mapped by extract_key if configured, else items as-is)
 *   count     — number of items processed
 *   first     — first result (or null)
 *   last      — last result (or null)
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';

export async function realLoop(ctx: NodeContext): Promise<NodeExecuteResult> {
  const itemsKey  = (ctx.config['items_key']   as string | undefined) ?? 'items';
  const extractKey = ctx.config['extract_key'] as string | undefined;
  const label      = (ctx.config['label']      as string | undefined) ?? 'loop';

  // Resolve items array: check upstream outputs first, then direct config, then inputs
  let rawItems: unknown = ctx.upstream
    ? Object.values(ctx.upstream).reduceRight(
        (found, upstreamOutput) =>
          found !== undefined ? found : (upstreamOutput as Record<string, unknown>)[itemsKey],
        undefined as unknown,
      )
    : undefined;

  if (rawItems === undefined) rawItems = ctx.inputs[itemsKey];
  if (rawItems === undefined) rawItems = ctx.config['items'];

  if (!Array.isArray(rawItems)) {
    return {
      status: 'failure',
      outputs: {},
      error: {
        code:    'LOOP_NO_ARRAY',
        message: `core.loop: expected array at key "${itemsKey}" but found ${typeof rawItems}. ` +
                 `Pass items via upstream output or config.items.`,
      },
    };
  }

  const items = rawItems as unknown[];

  // Map items
  const results: unknown[] = items.map((item) => {
    if (extractKey && typeof item === 'object' && item !== null) {
      return (item as Record<string, unknown>)[extractKey];
    }
    return item;
  });

  ctx.logger.info(
    `[core.loop] ${label}: processed ${results.length} item(s)` +
    (extractKey ? ` (extracted key "${extractKey}")` : ''),
  );

  return {
    status: 'success',
    outputs: {
      results,
      count: results.length,
      first: results[0]  ?? null,
      last:  results[results.length - 1] ?? null,
    },
  };
}
