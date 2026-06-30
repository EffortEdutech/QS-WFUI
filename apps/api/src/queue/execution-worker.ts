/**
 * ExecutionWorker — Phase 12
 *
 * BullMQ Worker that dequeues execution jobs and runs them via the
 * existing @lados/execution-engine runWorkflow() function.
 *
 * Runs in the same process as the API (single-process model).
 * The WorkflowRunner interface is unchanged — no pack code is touched.
 *
 * Emits progress events via NestJS EventEmitter2 so the SSE controller
 * can stream them to the UI.
 *
 * Retry strategy: 3 attempts, exponential backoff (5s, 30s, 2min).
 * On final failure: run is marked 'failed' in DB.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 }  from '@nestjs/event-emitter';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FileService }    from '../file/file.service';
import { LibraryService } from '../library/library.service';
import { AiService }      from '../ai/ai.service';
import { DocumentService } from '../document/document.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService }        from '../notification/email.service';   // Phase 10
import { SmsService }          from '../notification/sms.service';     // Phase 10
import { ResourceService } from '../resource/resource.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { StateEngineService } from '../state-engine/state-engine.service';
import { SecurityEngineService } from '../security/security.service';
import { ApprovalTaskCreator } from '../approval/approval-task.creator';
import { ArtifactService }  from '../artifact/artifact.service';
import { ExecutionQueueService, parseRedisUrl } from './execution-queue.service';
import { buildRealNodeResolver } from '../execution/real-nodes';
import { runWorkflow } from '@lados/execution-engine';
import type { QSWorkflowDefinition } from '@lados/shared-types';
import {
  EXECUTION_QUEUE_NAME,
  EXECUTION_JOB_TYPE,
  ExecutionJobPayload,
  RUN_EVENT,
} from './queue.constants';

@Injectable()
export class ExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionWorker.name);
  private worker: Worker<ExecutionJobPayload> | undefined;
  private readonly nodeResolver: ReturnType<typeof buildRealNodeResolver>;

  constructor(
    private readonly supabase:      SupabaseService,
    private readonly fileService:   FileService,
    private readonly libraryService: LibraryService,
    private readonly aiService:     AiService,
    private readonly documentService: DocumentService,
    private readonly notificationService: NotificationService,
    private readonly resourceService: ResourceService,
    private readonly eventBus:      EventBusService,
    private readonly stateEngine:   StateEngineService,
    private readonly security:      SecurityEngineService,
    private readonly approvalTaskCreator: ApprovalTaskCreator,
    private readonly artifactService: ArtifactService,
    private readonly queueService:  ExecutionQueueService,
    private readonly emitter:       EventEmitter2,
    private readonly emailService:  EmailService,    // Phase 10
    private readonly smsService:    SmsService,      // Phase 10
  ) {
    this.nodeResolver = buildRealNodeResolver(
      fileService, libraryService, aiService, documentService,
      notificationService, resourceService, eventBus, stateEngine,
      approvalTaskCreator, artifactService,
      emailService, smsService,
    );
  }

  onModuleInit() {
    // Read REDIS_URL directly — avoids NestJS module init order dependency
    // (QueueModule and ExecutionModule initialize in parallel; getConnectionOptions()
    // may still be undefined when this runs even though Redis IS configured).
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('No Redis config — worker not started (in-process fallback active)');
      return;
    }
    const connectionOptions: ConnectionOptions = parseRedisUrl(redisUrl);

    this.worker = new Worker<ExecutionJobPayload>(
      EXECUTION_QUEUE_NAME,
      async (job) => this.process(job),
      {
        connection:  connectionOptions,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed (run ${job.data.runId})`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed (run ${job?.data?.runId}): ${err.message}`);
    });

    // Must handle 'error' explicitly — BullMQ emits ECONNRESET / Redis reconnect
    // errors here and Node will crash with unhandledRejection if this is absent.
    this.worker.on('error', (err) => {
      this.logger.warn(`ExecutionWorker connection error (will retry): ${err.message}`);
    });

    this.logger.log('ExecutionWorker started — concurrency 5');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  // ── Job processor ────────────────────────────────────────────────────────

  private async process(job: Job<ExecutionJobPayload>): Promise<void> {
    const { type, runId, workflowId, projectId, orgId, userId, skipNodes, resumeFromCheckpoint } = job.data;

    this.logger.log(`Processing ${type} job for run ${runId} (attempt ${job.attemptsMade + 1})`);

    // Load workflow snapshot from DB (already stored at trigger time)
    const { data: run, error: runErr } = await this.supabase.admin
      .from('execution_runs')
      .select('workflow_snapshot, inputs')
      .eq('id', runId)
      .single();

    if (runErr || !run) {
      throw new Error(`Run ${runId} not found in DB`);
    }

    const definition = run['workflow_snapshot'] as QSWorkflowDefinition;
    const inputs     = (run['inputs'] ?? {}) as Record<string, unknown>;

    const options: Parameters<typeof runWorkflow>[0] = {
      executionId:    runId,
      workflowId,
      projectId,
      organizationId: orgId,
      userId,
      definition,
      inputs,
      variables:      {},
      nodeResolver:   this.nodeResolver,
      skipNodes:      skipNodes ?? [],
      ...(type === EXECUTION_JOB_TYPE.RESUME && resumeFromCheckpoint
        ? { resumeFromCheckpoint }
        : {}),
    };

    await this._executeAndPersist(runId, workflowId, orgId, userId, options);
  }

  // ── Core runner ─────────────────────────────────────────────────────────

  private async _executeAndPersist(
    runId:      string,
    workflowId: string,
    orgId:      string,
    userId:     string,
    options:    Parameters<typeof runWorkflow>[0],
  ): Promise<void> {
    let result;
    try {
      result = await runWorkflow(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      await this.supabase.admin.from('execution_runs').update({
        status:       'failed',
        error:        { code: 'RUNNER_EXCEPTION', message },
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      void this.eventBus.publish({
        orgId,
        type:       'workflow.failed',
        sourceType: 'workflow',
        sourceId:   workflowId,
        actorId:    userId,
        payload:    { runId, error: { code: 'RUNNER_EXCEPTION', message } },
      });

      // Emit SSE event
      this.emitter.emit(RUN_EVENT.RUN_FAILED, { runId, error: message });

      throw err; // re-throw so BullMQ records the failure and retries
    }

    // Persist node logs
    if (result.logs.length > 0) {
      const logRows = result.logs.map((log) => ({
        run_id:       runId,
        node_id:      log.nodeId,
        node_type:    log.nodeType,
        node_name:    log.nodeName,
        status:       log.status,
        inputs:       log.inputs ?? null,
        outputs:      log.outputs ?? null,
        error:        log.error ?? null,
        messages:     log.messages ?? [],
        started_at:   log.startedAt ?? null,
        completed_at: log.completedAt ?? null,
        duration_ms:  log.durationMs ?? null,
      }));
      await this.supabase.admin.from('execution_logs').insert(logRows);
    }

    // Update run record
    await this.supabase.admin.from('execution_runs').update({
      status:               result.status,
      outputs:              result.outputs ?? null,
      error:                result.error ?? null,
      completed_at:         result.status !== 'paused' ? result.completedAt : null,
      duration_ms:          result.durationMs,
      ...(result.status === 'paused' && {
        paused_at_node_id:  result.pausedAtNodeId,
        checkpoint_outputs: result.checkpointOutputs,
      }),
    }).eq('id', runId);

    // Publish workflow lifecycle event
    const lifecycleType =
      result.status === 'completed' ? 'workflow.completed' :
      result.status === 'paused'    ? 'workflow.paused'    :
                                      'workflow.failed';

    void this.eventBus.publish({
      orgId,
      type:       lifecycleType,
      sourceType: 'workflow',
      sourceId:   workflowId,
      actorId:    userId,
      payload: {
        runId,
        durationMs: result.durationMs,
        nodeCount:  result.logs.length,
        ...(result.status === 'paused' && { pausedAtNodeId: result.pausedAtNodeId }),
        ...(result.status === 'failed' && { error: result.error }),
      },
    });

    // Persist audit log
    const { data: workflow } = await this.supabase.admin
      .from('workflows').select('name, project_id').eq('id', workflowId).single();
    const { data: project }  = await this.supabase.admin
      .from('projects').select('organization_id').eq('id', options.projectId).maybeSingle();

    const workflowName = (workflow?.['name'] as string | undefined) ?? 'Workflow';
    const eventType =
      result.status === 'completed' ? 'run.completed' :
      result.status === 'paused'    ? 'run.paused'    :
                                      'run.failed';
    const summary =
      result.status === 'completed'
        ? `Workflow "${workflowName}" completed in ${result.durationMs}ms`
        : result.status === 'paused'
        ? `Workflow "${workflowName}" paused — awaiting human approval`
        : `Workflow "${workflowName}" failed: ${result.error?.message ?? 'unknown'}`;

    await this.supabase.admin.from('audit_log').insert({
      organization_id: project?.['organization_id'],
      project_id:      workflow?.['project_id'],
      actor_id:        userId,
      event_type:      eventType,
      entity_type:     'run',
      entity_id:       runId,
      summary,
      metadata: {
        workflow_id: workflowId,
        duration_ms: result.durationMs,
        node_count:  result.logs.length,
      },
    });

    // Emit SSE progress event
    if (result.status === 'completed') {
      this.emitter.emit(RUN_EVENT.RUN_COMPLETE, { runId, durationMs: result.durationMs });
    } else if (result.status === 'paused') {
      this.emitter.emit(RUN_EVENT.RUN_PAUSED,   { runId, pausedAtNodeId: result.pausedAtNodeId });
    } else {
      this.emitter.emit(RUN_EVENT.RUN_FAILED,   { runId, error: result.error?.message ?? 'unknown' });
    }
  }
}
