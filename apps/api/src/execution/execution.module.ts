import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { FileModule } from '../file/file.module';
import { LibraryModule } from '../library/library.module';
import { ResourceModule } from '../resource/resource.module';
import { StateEngineModule } from '../state-engine/state-engine.module';
import { ApprovalCoreModule } from '../approval/approval-core.module';
import { ArtifactModule } from '../artifact/artifact.module';

// AiModule, NotificationModule, DocumentModule, EventBusModule are @Global() — available via global scope.
// Phase 7:  ApprovalCoreModule provides ApprovalTaskCreator (no circular dep with ExecutionModule).
// Phase 9C: ArtifactModule provides ArtifactService for artifact.write / artifact.read nodes.
// Phase 12: QueueModule is @Global() — ExecutionQueueService injected from global scope.

@Module({
  imports: [FileModule, LibraryModule, ResourceModule, StateEngineModule, ApprovalCoreModule, ArtifactModule],
  controllers: [ExecutionController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
