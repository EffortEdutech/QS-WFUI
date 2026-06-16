/**
 * Real node resolver for NestJS execution context.
 *
 * Returns a real implementation function for node types that have one.
 * Falls back to mock for everything else.
 * Sprint 7 (S7-004) · Sprint 8 (S8-003)
 */
import type { NodeContext, NodeExecuteResult } from '@qsos/execution-engine';
import type { FileService } from '../../file/file.service';
import type { LibraryService } from '../../library/library.service';
import { realUploadFile } from './document-upload-file';
import { realReadExcel } from './document-read-excel';
import { realReadBoq } from './qs-read-boq';

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * Build the real node resolver, injecting NestJS services.
 * Call this once in ExecutionService and pass to WorkflowRunner.
 */
export function buildRealNodeResolver(
  fileService: FileService,
  libraryService: LibraryService,
): (nodeType: string) => NodeExecutor | null {
  const realNodes: Record<string, NodeExecutor> = {
    'document.upload_file': (ctx) => realUploadFile(ctx),
    'document.read_excel':  (ctx) => realReadExcel(ctx, fileService, libraryService),
    'qs.read_boq':          (ctx) => realReadBoq(ctx),
  };

  return (nodeType: string) => realNodes[nodeType] ?? null;
}
