/**
 * ExecutionQueueService — Phase 12
 *
 * Wraps BullMQ Queue. Called by ExecutionService instead of
 * calling _executeAndPersist() directly.
 *
 * Two job types:
 *   TRIGGER — new run (runId already created in DB before enqueue)
 *   RESUME  — resume a paused run after human approval decision
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import {
  EXECUTION_QUEUE_NAME,
  EXECUTION_JOB_TYPE,
  ExecutionJobPayload,
} from './queue.constants';

@Injectable()
export class ExecutionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionQueueService.name);
  private connection: IORedis;
  private queue: Queue<ExecutionJobPayload>;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — BullMQ queue disabled, falling back to in-process execution');
      return;
    }

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck:     false,
      tls:                  redisUrl.startsWith('rediss://') ? {} : undefined,
    });

    this.queue = new Queue<ExecutionJobPayload>(EXECUTION_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },  // keep last 100 completed jobs for debugging
        removeOnFail:     { count: 500 },  // keep failed jobs longer
      },
    });

    this.logger.log(`BullMQ queue "${EXECUTION_QUEUE_NAME}" connected to Redis`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.connection?.quit();
  }

  /** Returns true if the queue is available (Redis connected). */
  get isAvailable(): boolean {
    return !!this.queue;
  }

  /**
   * Enqueue a new workflow run.
   * runId must already exist in execution_runs (status = 'running').
   */
  async enqueueTrigger(payload: Omit<ExecutionJobPayload, 'type'>): Promise<void> {
    if (!this.queue) return; // fallback: caller handles in-process execution
    await this.queue.add(
      EXECUTION_JOB_TYPE.TRIGGER,
      { ...payload, type: EXECUTION_JOB_TYPE.TRIGGER },
      { jobId: `trigger-${payload.runId}` },
    );
    this.logger.debug(`Enqueued TRIGGER job for run ${payload.runId}`);
  }

  /**
   * Re-enqueue a paused run after an approval decision.
   * DB state is updated by ExecutionService before calling this.
   */
  async enqueueResume(payload: Omit<ExecutionJobPayload, 'type'>): Promise<void> {
    if (!this.queue) return;
    await this.queue.add(
      EXECUTION_JOB_TYPE.RESUME,
      { ...payload, type: EXECUTION_JOB_TYPE.RESUME },
      { jobId: `resume-${payload.runId}-${Date.now()}` },
    );
    this.logger.debug(`Enqueued RESUME job for run ${payload.runId}`);
  }

  /** Expose connection for the worker to share (avoids double Redis connection). */
  getConnection(): IORedis | undefined {
    return this.connection;
  }
}
