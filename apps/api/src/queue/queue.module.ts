/**
 * QueueModule — Phase 12: Async Execution Queue
 *
 * Provides:
 *   - BullMQ Queue connection (Upstash Redis via REDIS_URL)
 *   - ExecutionQueueService  (enqueue trigger + resume jobs)
 *
 * @Global so ExecutionService can inject ExecutionQueueService without
 * importing QueueModule in every consumer module.
 *
 * The ExecutionWorker is registered here but runs in the same process
 * as the API (single-process model — sufficient for Contractor Edition scale).
 */
import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ExecutionQueueService } from './execution-queue.service';
import { QueueController }       from './queue.controller'; // Phase 12

// ExecutionWorker lives in ExecutionModule — it needs FileModule, LibraryModule,
// ResourceModule, StateEngineModule, ApprovalCoreModule, ArtifactModule etc.,
// which are already imported there. Keeping the worker there avoids importing
// every feature module into this lightweight QueueModule.

@Global()
@Module({
  imports: [
    // EventEmitter for SSE progress (in-process pub/sub — worker → SSE controller)
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),
  ],
  controllers: [QueueController], // Phase 12 — GET /queue/health + /queue/failed-jobs
  providers:   [ExecutionQueueService],
  exports:     [ExecutionQueueService],
})
export class QueueModule {}
