/**
 * Real node resolver for NestJS execution context.
 *
 * Returns a real implementation function for node types that have one.
 * Falls back to mock for everything else.
 * Sprint 7  (S7-004) · Sprint 8 (S8-003) · Sprint 9 (S9-003)
 * Sprint 10 (S10-002) · Sprint 11 (S11-004) · Sprint 14 (S14-001, S14-006)
 */
import type { NodeContext, NodeExecuteResult } from '@qsos/execution-engine';
import type { FileService } from '../../file/file.service';
import type { LibraryService } from '../../library/library.service';
import type { AiService } from '../../ai/ai.service';
import type { DocumentService } from '../../document/document.service';
import type { NotificationService } from '../../notification/notification.service';
import { realHumanApproval } from './core-human-approval';
import { realLogger } from './core-logger';
import { realSaveArtifact } from './project-save-artifact';
import { realReadArtifact } from './project-read-artifact';
import { realUploadFile } from './document-upload-file';
import { realReadExcel } from './document-read-excel';
import { realReadBoq } from './qs-read-boq';
import { realCleanBoq } from './qs-clean-boq';
import { realClassifyTrade } from './qs-classify-trade';
import { realSplitWorkPackage } from './qs-split-work-package';
import { realGenerateRfq } from './procurement-generate-rfq';
import { realCondition } from './workflow-condition';

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * Build the real node resolver, injecting NestJS services.
 * Call this once in ExecutionService and pass to WorkflowRunner.
 */
export function buildRealNodeResolver(
  fileService: FileService,
  libraryService: LibraryService,
  aiService: AiService,
  documentService?: DocumentService,
  notificationService?: NotificationService,
): (nodeType: string) => NodeExecutor | null {
  const realNodes: Record<string, NodeExecutor> = {
    // ── Core Pack ─────────────────────────────────────────────────────────────
    'core.human_approval': (ctx) => realHumanApproval(ctx, notificationService),
    'core.logger':         (ctx) => realLogger(ctx),
    'workflow.condition':  (ctx) => realCondition(ctx),

    // ── Pipeline Pack ─────────────────────────────────────────────────────────
    'project.save_artifact': (ctx) => realSaveArtifact(ctx),
    'project.read_artifact': (ctx) => realReadArtifact(ctx),

    // ── Document Pack ─────────────────────────────────────────────────────────
    'document.upload_file': (ctx) => realUploadFile(ctx),
    'document.read_excel':  (ctx) => realReadExcel(ctx, fileService, libraryService, documentService),

    // ── QS Pack ───────────────────────────────────────────────────────────────
    'qs.read_boq':          (ctx) => realReadBoq(ctx),
    'qs.clean_boq':         (ctx) => realCleanBoq(ctx),
    'qs.classify_trade':    (ctx) => realClassifyTrade(ctx,