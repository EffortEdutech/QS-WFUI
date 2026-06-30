/**
 * SchedulerModule — Phase 10
 *
 * Provides SchedulerService which polls for cron-triggered workflow subscriptions
 * and fires them via the execution queue.
 *
 * Dependencies resolved from global scope:
 *   - SupabaseService  (@Global via SupabaseModule)
 *   - ExecutionQueueService (@Global via QueueModule)
 */
import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Module({
  providers: [SchedulerService],
  exports:   [SchedulerService],
})
export class SchedulerModule {}
