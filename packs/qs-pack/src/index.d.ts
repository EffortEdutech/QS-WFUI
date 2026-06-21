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
export type { BOQItem, BOQDocument } from './nodes/qs-read-boq';
export type { ClassifiedItem, TradeCategory, IAiService } from './nodes/qs-classify-trade';
export type { WorkPackage } from './nodes/qs-split-work-package';
export declare const PACK_ID: "qs-pack";
export declare const PACK_VERSION: "0.2.0";
export declare const manifest: PackManifest;
export interface QsPackServices {
    aiService: import('./nodes/qs-classify-trade').IAiService;
}
type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
/**
 * Returns the real executor for a qs-pack node type, or null if unknown.
 */
export declare function resolveNode(services: QsPackServices): (nodeType: string) => NodeExecutor | null;
//# sourceMappingURL=index.d.ts.map