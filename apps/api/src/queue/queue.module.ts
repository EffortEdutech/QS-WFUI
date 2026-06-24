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
import { ExecutionWorker }      from './execution-worker';

@Global()
@Module({
  imports: [
    // EventEmitter for SSE progress (in-process pub/sub — worker → SSE controller)
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),
  ],
  providers: [ExecutionQueueService, ExecutionWorker],
  exports:   [ExecutionQueueService],
})
export class QueueModule {}
