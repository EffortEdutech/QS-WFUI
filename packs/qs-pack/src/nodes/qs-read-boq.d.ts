/**
 * Real implementation: qs.read_boq
 *
 * Takes parsed Excel rows from document.read_excel and converts them into
 * a structured BOQ with item number, description, unit, qty, rate, amount.
 * Auto-detects column mapping from header names.
 * Sprint 7 (S7-004)
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export interface BOQItem {
    item_no: string;
    description: string;
    unit: string;
    qty: number | null;
    rate: number | null;
    amount: number | null;
    is_section_header: boolean;
    trade?: string;
}
export interface BOQDocument {
    boq_id: string;
    source_file_id: string | null;
    currency: string;
    total_items: number;
    section_count: number;
    total_value: number;
    items: BOQItem[];
    sections: string[];
}
export declare function realReadBoq(ctx: NodeContext): Promise<NodeExecuteResult>;
//# sourceMappingURL=qs-read-boq.d.ts.map