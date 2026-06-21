/**
 * @lados/qs-pack
 *
 * Quantity Surveying domain nodes — BOQ read, clean, classify, split work packages.
 *
 * Phase 2: nodes migrated from apps/api/src/execution/real-nodes/
 *
 * Also exports shared types (BOQItem, BOQDocument, ClassifiedItem, WorkPackage)
 * consumed by @lados/procurement-pack.
 */
import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realReadBoq }          from './nodes/qs-read-boq';
import { realCleanBoq }         from './nodes/qs-clean-boq';
import { realClassifyTrade }    from './nodes/qs-classify-trade';
import { realSplitWorkPackage } from './nodes/qs-split-work-package';

// ── Re-export shared types for procurement-pack and UI consumers ──────────────
export type { BOQItem, BOQDocument }                   from './nodes/qs-read-boq';
export type { ClassifiedItem, TradeCategory, IAiService } from './nodes/qs-classify-trade';
export type { WorkPackage }                            from './nodes/qs-split-work-package';

export const PACK_ID      = 'qs-pack' as const;
export const PACK_VERSION = '0.2.0' as const;

export const manifest: PackManifest = {
  id: PACK_ID,
  version: PACK_VERSION,
  displayName: 'QS Pack',
  description: 'Quantity Surveying — BOQ reading, trade classification, cost plans, RFQ splitting, rate analysis',
  author: 'Lados Platform',
  nodes: [
    'qs.read_boq',
    'qs.clean_boq',
    'qs.classify_trade',
    'qs.split_work_package',
  ],
};

export interface QsPackServices {
  aiService: import('./nodes/qs-classify-trade').IAiService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * Returns the real executor for a qs-pack node type, or null if unknown.
 */
export function resolveNode(
  services: QsPackServices,
): (nodeType: string) => NodeExecutor | null {
  const { aiService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'qs.read_boq':           (ctx) => realReadBoq(ctx),
    'qs.clean_boq':          (ctx) => realCleanBoq(ctx),
    'qs.classify_trade':     (ctx) => realClassifyTrade(ctx, aiService),
    'qs.split_work_package': (ctx) => realSplitWorkPackage(ctx),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
