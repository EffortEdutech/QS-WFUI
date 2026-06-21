/**
 * Real implementation: qs.split_work_package
 *
 * Groups classified BOQ items by trade into discrete work packages,
 * ready for individual RFQ generation.
 *
 * Input (from qs.classify_trade):
 *   ctx.inputs['classified_items'] — ClassifiedItem[]
 *   ctx.inputs['currency']         — 'MYR' | 'USD' | etc.
 *
 * Sprint 9 (S9-003)
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { ClassifiedItem, TradeCategory } from './qs-classify-trade';
export interface WorkPackage {
    trade: TradeCategory;
    label: string;
    item_count: number;
    line_item_count: number;
    subtotal: number;
    currency: string;
    items: ClassifiedItem[];
}
export declare function realSplitWorkPackage(ctx: NodeContext): Promise<NodeExecuteResult>;
//# sourceMappingURL=qs-split-work-package.d.ts.map