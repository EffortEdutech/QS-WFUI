/**
 * @lados/document-pack
 *
 * Document processing nodes — Excel reading, file upload.
 *
 * Phase 2: nodes migrated from apps/api/src/execution/real-nodes/
 */
import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realUploadFile } from './nodes/document-upload-file';
import { realReadExcel }  from './nodes/document-read-excel';

export { type IFileService, type ILibraryService, type IDocumentService, type ExcelRow }
  from './nodes/document-read-excel';

export const PACK_ID      = 'document-pack' as const;
export const PACK_VERSION = '0.2.0' as const;

export const manifest: PackManifest = {
  id: PACK_ID,
  version: PACK_VERSION,
  displayName: 'Document Pack',
  description: 'Document business capabilities — Excel reading, file upload, PDF generation',
  author: 'Lados Platform',
  nodes: [
    'document.upload_file',
    'document.read_excel',
  ],
};

export interface DocumentPackServices {
  fileService: import('./nodes/document-read-excel').IFileService;
  libraryService?: import('./nodes/document-read-excel').ILibraryService;
  documentService?: import('./nodes/document-read-excel').IDocumentService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * Returns the real executor for a document-pack node type, or null if unknown.
 */
export function resolveNode(
  services: DocumentPackServices,
): (nodeType: string) => NodeExecutor | null {
  const { fileService, libraryService, documentService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'document.upload_file': (ctx) => realUploadFile(ctx),
    'document.read_excel':  (ctx) => realReadExcel(ctx, fileService, libraryService, documentService),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
