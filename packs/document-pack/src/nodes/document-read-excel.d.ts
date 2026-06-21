import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
export type ExcelRow = Record<string, string | number | boolean | null | undefined> & {
    row?: number;
};
export interface IFileService {
    getUpload(fileId: string): Promise<{
        storage_path: string;
    }>;
    downloadFile(storagePath: string): Promise<Buffer>;
}
export interface ILibraryService {
    getFile(fileId: string): Promise<{
        storage_path: string;
    }>;
    downloadFile(storagePath: string): Promise<Buffer>;
}
export interface IDocumentService {
    parseExcel(buffer: Buffer, options?: {
        headerRow?: number | string;
        sheetName?: string;
    }): {
        sheetName: string;
        sheets: string[];
        headers: string[];
        rows: ExcelRow[];
        rowCount: number;
    };
}
export declare function realReadExcel(ctx: NodeContext, fileService: IFileService, libraryService?: ILibraryService, documentService?: IDocumentService): Promise<NodeExecuteResult>;
//# sourceMappingURL=document-read-excel.d.ts.map