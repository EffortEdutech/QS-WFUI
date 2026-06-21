/**
 * Real implementation: qs.clean_boq
 *
 * Normalises BOQ items — removes zero-quantity lines, trims whitespace,
 * and passes the cleaned BOQ to downstream nodes.
 *
 * Phase 2: migrated from apps/api/src/execution/real-nodes/ to qs-pack
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export declare function realCleanBoq(ctx: NodeContext): Promise<NodeExecuteResult>;
//# sourceMappingURL=qs-clean-boq.d.ts.map