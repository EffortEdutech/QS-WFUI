/**
 * ApprovalCoreModule — Phase 7
 *
 * Lightweight module that provides only ApprovalTaskCreator.
 * Kept separate from ApprovalModule to break the circular dependency:
 *
 *   ApprovalModule  → ExecutionModule  (needs ExecutionService for resumeRun)
 *   ExecutionModule → ApprovalModule   ← would be circular
 *
 * Solution:
 *   ExecutionModule → ApprovalCoreModule  (only ApprovalTaskCreator — no ExecutionService dep)
 *   ApprovalModule  → ApprovalCoreModule + ExecutionModule  (no cycle)
 */

import { Module } from '@nestjs/common';
import { ApprovalTaskCreator } from './approval-task.creator';

@Module({
  providers: [ApprovalTaskCreator],
  exports:   [ApprovalTaskCreator],
})
export class ApprovalCoreModule {}
