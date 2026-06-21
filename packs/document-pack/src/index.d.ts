import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export { type IFileService, type ILibraryService, type IDocumentService, type ExcelRow } from './nodes/document-read-excel';
export declare const PACK_ID: "document-pack";
export declare const PACK_VERSION: "0.2.0";
export declare const manifest: PackManifest;
export interface DocumentPackServices {
    fileService: import('./nodes/document-read-excel').IFileService;
    libraryService?: import('./nodes/document-read-excel').ILibraryService;
    documentService?: import('./nodes/document-read-excel').IDocumentService;
}
type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
export declare function resolveNode(services: DocumentPackServices): (nodeType: string) => NodeExecutor | null;
//# sourceMappingURL=index.d.ts.map