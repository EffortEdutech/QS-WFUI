import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export interface ILibraryService {
    uploadBuffer(buffer: Buffer, storagePath: string, contentType: string): Promise<string>;
    createSignedUrl(storagePath: string, expiresIn: number): Promise<string>;
}
export interface RfqArtifact {
    trade: string;
    label: string;
    storage_path: string;
    url: string;
    size_bytes: number;
    package_value: number;
    currency: string;
    item_count: number;
}
export declare function realGenerateRfq(ctx: NodeContext, libraryService: ILibraryService): Promise<NodeExecuteResult>;
//# sourceMappingURL=procurement-generate-rfq.d.ts.map