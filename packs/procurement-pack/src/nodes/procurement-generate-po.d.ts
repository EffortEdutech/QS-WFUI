import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { ILibraryService } from './procurement-generate-rfq';
export interface PoLineItem {
    item_no?: string;
    description: string;
    unit?: string;
    qty?: number | null;
    rate?: number | null;
    amount?: number | null;
}
export interface PoArtifact {
    trade: string;
    label: string;
    storage_path: string;
    url: string;
    size_bytes: number;
    total_amount: number;
    currency: string;
    item_count: number;
    po_reference: string;
}
export declare function realGeneratePo(ctx: NodeContext, libraryService: ILibraryService): Promise<NodeExecuteResult>;
//# sourceMappingURL=procurement-generate-po.d.ts.map