/**
 * Real implementation: qs.classify_trade
 *
 * Classifies BOQ line items into standard CIDB trade categories.
 * Uses OpenAI (via IAiService) when configured; falls back to a
 * built-in keyword classifier so the workflow runs without an API key.
 *
 * Security note: AI is advisory only — confidence scores and warnings
 * are surfaced for human review. AI must not approve or certify anything.
 *
 * Phase 2: migrated from apps/api/src/execution/real-nodes/ to qs-pack
 *          NestJS AiService replaced with local IAiService interface.
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { BOQItem } from './qs-read-boq';
export interface IAiService {
    isConfigured: boolean;
    runCompletion(systemPrompt: string, userPrompt: string, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<string>;
}
export type TradeCategory = 'civil' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'finishing' | 'external' | 'preliminaries' | 'others';
export interface ClassifiedItem extends BOQItem {
    trade: TradeCategory;
    confidence: number;
    classified_by: 'ai' | 'keyword' | 'section';
}
export declare function realClassifyTrade(ctx: NodeContext, aiService: IAiService): Promise<NodeExecuteResult>;
//# sourceMappingURL=qs-classify-trade.d.ts.map