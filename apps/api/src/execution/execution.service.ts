/**
 * ExecutionService — Phase 12 (Async Execution Queue)
 *
 * - Creates run records and enqueues jobs via ExecutionQueueService
 * - Falls back to in-process execution when Redis is not available (dev without Redis)
 * - All actual runner logic lives in ExecutionWorker (queue path) or _executeAndPersist (fallback)
 * - Sprint 6 (S6-003) · Phase 12 (S12-004)
 *
 * Security note: AI is advisory only. AI must not approve, certify, decide
 * entitlement, or impersonate a registered Professional Quantity Surveyor.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FileService } from '../file/file.service';
import { LibraryService } from '../library/library.service';
import { AiService } from '../ai/ai.service';
import { DocumentService } from '../document/document.service';
import { NotificationService } from '../notification/notification.service';
import { ResourceService } from '../resource/resource.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { StateEngineService } from '../state-engine/state-engine.service';
import { SecurityEngineService } from '../security/security.service';
import { ApprovalTaskCreator } from '../approval/approval-task.creator';
import { ArtifactService }     from '../artifact/artifact.service';
import { ExecutionQueueService } from '../queue/execution-queue.service';
import { PackRegistryService }   from '../pack/pack-registry.service';
import { buildRealNodeResolver } from './real-nodes';
import { runWorkflow } from '@lados/execution-engine';
import type { SkipNodeSpec } from '@lados/execution-engine';
import type { QSWorkflowDefinition } from '@lados/shared-types';
import type { TriggerRunDto } from './dto/trigger-run.dto';

@Injectable()
export class ExecutionService implements OnModuleInit {
  private readonly nodeResolver: ReturnType<typeof buildRealNodeResolver>;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fileService: FileService,
    private readonly libraryService: LibraryService,
    private readonly aiService: AiService,
    private readonly documentService: DocumentService,
    private readonly notificationService: NotificationService,
    private readonly resourceService: ResourceService,
    private readonly eventBus: EventBusService,
    private readonly stateEngine: StateEngineService,
    private readonly security: SecurityEngineService,
    private readonly approvalTaskCreator: ApprovalTaskCreator,
    private readonly artifactService: ArtifactService,
    private readonly executionQueue: ExecutionQueueService,
    private readonly packRegistry: PackRegistryService,
  ) {
    // nodeResolver used only for in-process fallback (no Redis) and executeNodeAction.
    this.nodeResolver = buildRealNodeResolver(
      this.fileService,
      this.libraryService,
      this.aiService,
      this.documentService,
      this.notificationService,
      this.resourceService,
      this.eventBus,
      this.stateEngine,
      this.approvalTaskCreator,
      this.artifactService,
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onModuleInit(): void {
    // Register the workflow trigger callback on EventBusService.
    // Done here (not in the constructor) to avoid circular dependency issues
    // during NestJS module initialization.
    this.eventBus.setWorkflowTrigger(
      async (workflowId, orgId, actorId, inputs) => {
        await this._triggerFromEvent(workflowId, orgId, actorId, inputs);
      },
    );
  }

  // ── Trigger ────────────────────────────────────────────────────────────────

  async triggerRun(workflowId: string, dto: TriggerRunDto, userId: string) {
    // Load workflow + verify access
    const { data: workflow, error: wfErr } = await this.supabase.admin
      .from('workflows')
      .select('id, name, project_id, definition, status, published_version_id')
      .eq('id', workflowId)
      .single();

    if (wfErr ?? !workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', workflow.project_id as string)
      .maybeSingle();

    if (!project) throw new NotFoundException('Project not found');

    await this.assertMembership(project.organization_id as string, userId);

    // Phase 1 immutability guard: run from the published snapshot, not the live draft.
    // If no published version exists, block execution so stale drafts are never run in production.
    let definition = workflow.definition as QSWorkflowDefinition;
    if (workflow.published_version_id) {
      const { data: snap } = await this.supabase.admin
        .from('workflow_versions')
        .select('definition')
        .eq('id', workflow.published_version_id as string)
        .single();
      if (snap?.definition) definition = snap.definition as QSWorkflowDefinition;
    } else {
      throw new BadRequestException(
        'Workflow has no published version — publish it first before triggering a run',
      );
    }

    if (!definition?.nodes?.length) {
      throw new BadRequestException('Published workflow has no nodes');
    }

    // Create execution_runs row (status = created)
    const { data: run, error: runErr } = await this.supabase.admin
      .from('execution_runs')
      .insert({
        workflow_id: workflowId,
        project_id: workflow.project_id,
        organization_id: project.organization_id,
        workflow_snapshot: definition,
        status: 'running',
        trigger_type: 'manual',
        inputs: dto.inputs ?? {},
        started_by: userId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runErr ?? !run) throw new Error(runErr?.message ?? 'Failed to create run record');

    const runId = run.id as string;

    // Publish workflow.started event (fire-and-forget — never blocks execution)
    void this.eventBus.publish({
      orgId:      project.organization_id as string,
      type:       'workflow.started',
      sourceType: 'workflow',
      sourceId:   workflowId,
      actorId:    userId,
      payload:    { runId, workflowName: workflow.name, triggerType: 'manual' },
    });

    // Phase 12: enqueue via BullMQ (falls back to in-process if Redis not available)
    // Phase 14: merge org-level disabled node types into skipNodes
    // getDisabledNodeTypes() returns type strings; convert to SkipNodeSpec[] by scanning the definition.
    const orgId = project.organization_id as string;
    const disabledNodeTypes = await this.packRegistry.getDisabledNodeTypes(orgId);
    const overrideSpecs: SkipNodeSpec[] = disabledNodeTypes.size > 0
      ? definition.nodes
          .filter((n) => disabledNodeTypes.has(n.type as string))
          .map((n) => ({ nodeId: n.id as string, reason: `Node type "${n.type}" is disabled for this org` }))
      : [];
    const skipNodes: SkipNodeSpec[] = [...(dto.skipNodes ?? []), ...overrideSpecs];

    if (this.executionQueue.isAvailable) {
      await this.executionQueue.enqueueTrigger({
        runId,
        workflowId,
        projectId:  workflow.project_id as string,
        orgId,
        userId,
        skipNodes,
      });
    } else {
      // In-process fallback (dev without Redis)
      const runOptions = {
        executionId:    runId,
        workflowId,
        projectId:      workflow.project_id as string,
        organizationId: orgId,
        skipNodes,
        userId,
        definition,
        inputs:         dto.inputs ?? {},
        variables:      dto.variables ?? {},
        nodeResolver:   this.nodeResolver,
      };
      this._executeAndPersist(runId, workflow, project as Record<string, unknown>, runOptions).catch((err: unknown) => {
        console.error(`[ExecutionService] Fallback run ${runId} threw: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    return { runId, status: 'running' };
  }

  // ── Resume a paused run after human approval ────────────────────────────

  async resumeRun(
    runId: string,
    approvalTaskId: string,
    approved: boolean,
    comments: string,
    userId: string,
  ) {
    const { data: run, error: runErr } = await this.supabase.admin
      .from('execution_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runErr || !run) throw new NotFoundException(`Run ${runId} not found`);
    if (run['status'] !== 'paused') {
      throw new BadRequestException(`Run ${runId} is not paused (status: ${run['status']})`);
    }

    await this.assertMembership(run['organization_id'] as string, userId);

    const { data: task, error: taskErr } = await this.supabase.admin
      .from('approval_tasks')
      .select('*')
      .eq('id', approvalTaskId)
      .eq('execution_id', runId)
      .single();

    if (taskErr || !task) throw new NotFoundException(`Approval task ${approvalTaskId} not found for run ${runId}`);
    if (task['status'] !== 'pending') throw new BadRequestException(`Approval task already ${task['status']}`);

    // Record the decision
    await this.supabase.admin.from('approval_tasks').update({
      status:      approved ? 'approved' : 'rejected',
      decided_by:  userId,
      decision_at: new Date().toISOString(),
      comments:    comments || (approved ? 'Approved' : 'Rejected'),
    }).eq('id', approvalTaskId);

    // Mark run as running again
    await this.supabase.admin.from('execution_runs').update({ status: 'running' }).eq('id', runId);

    const { data: workflow } = await this.supabase.admin
      .from('workflows')
      .select('id, name, project_id, definition')
      .eq('id', run['workflow_id'] as string)
      .single();

    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', run['project_id'] as string)
      .maybeSingle();

    const definition = (run['workflow_snapshot'] ?? workflow?.['definition']) as QSWorkflowDefinition;

    const resumeFromCheckpoint = {
      pausedAtNodeId:    run['paused_at_node_id'] as string,
      checkpointOutputs: (run['checkpoint_outputs'] ?? {}) as Record<string, Record<string, unknown>>,
      approvalResult: {
        approved,
        rejected:        !approved,
        comments:        comments || (approved ? 'Approved' : 'Rejected'),
        approvalTaskId,
        decidedBy:       userId,
      },
    };

    // Phase 12: re-enqueue via BullMQ (falls back to in-process if Redis not available)
    // Phase 14: apply org-level node overrides to skipNodes on resume
    const resumeOrgId = run['organization_id'] as string;
    const resumeDisabledTypes = await this.packRegistry.getDisabledNodeTypes(resumeOrgId);
    const resumeSkipNodes: SkipNodeSpec[] = resumeDisabledTypes.size > 0
      ? definition.nodes
          .filter((n) => resumeDisabledTypes.has(n.type as string))
          .map((n) => ({ nodeId: n.id as string, reason: `Node type "${n.type}" is disabled for this org` }))
      : [];

    if (this.executionQueue.isAvailable) {
      await this.executionQueue.enqueueResume({
        runId,
        workflowId:  run['workflow_id'] as string,
        projectId:   run['project_id'] as string,
        orgId:       resumeOrgId,
        userId,
        skipNodes:   resumeSkipNodes,
        resumeFromCheckpoint,
      });
    } else {
      // In-process fallback
      const resumeOptions = {
        executionId:    runId,
        workflowId:     run['workflow_id'] as string,
        projectId:      run['project_id'] as string,
        organizationId: resumeOrgId,
        userId,
        definition,
        inputs:         (run['inputs'] ?? {}) as Record<string, unknown>,
        variables:      {} as Record<string, unknown>,
        nodeResolver:   this.nodeResolver,
        skipNodes:      resumeSkipNodes,
        resumeFromCheckpoint,
      };
      this._executeAndPersist(runId, workflow, project, resumeOptions).catch((err: unknown) => {
        console.error(`[ExecutionService] Fallback resume ${runId} threw: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    return { runId, status: 'running', resumed: true };
  }

  // ── Internal: run workflow and persist results ───────────────────────────

  private async _executeAndPersist(
    runId: string,
    workflow: Record<string, unknown> | null,
    project: Record<string, unknown> | null,
    options: Parameters<typeof runWorkflow>[0],
  ) {
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
        orgId:      options.organizationId,
        type:       'workflow.failed',
        sourceType: 'workflow',
        sourceId:   options.workflowId,
        actorId:    options.userId,
        payload:    { runId, error: { code: 'RUNNER_EXCEPTION', message } },
      });
      return;
    }

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
    const lifecycleType = result.status === 'completed' ? 'workflow.completed'
      : result.status === 'paused'                      ? 'workflow.paused'
      : 'workflow.failed';
    void this.eventBus.publish({
      orgId:      options.organizationId,
      type:       lifecycleType,
      sourceType: 'workflow',
      sourceId:   options.workflowId,
      actorId:    options.userId,
      payload:    {
        runId,
        durationMs:   result.durationMs,
        nodeCount:    result.logs.length,
        ...(result.status === 'paused'  && { pausedAtNodeId: result.pausedAtNodeId }),
        ...(result.status === 'failed'  && { error: result.error }),
      },
    });

    const workflowName = (workflow?.['name'] as string | undefined) ?? 'Workflow';
    const eventType = result.status === 'completed' ? 'run.completed'
      : result.status === 'paused'                  ? 'run.paused'
      : 'run.failed';
    const summary = result.status === 'completed'
      ? `Workflow "${workflowName}" completed in ${result.durationMs}ms`
      : result.status === 'paused'
      ? `Workflow "${workflowName}" paused — awaiting human approval`
      : `Workflow "${workflowName}" failed: ${result.error?.message ?? 'unknown'}`;

    await this.supabase.admin.from('audit_log').insert({
      organization_id: project?.['organization_id'],
      project_id:      workflow?.['project_id'],
      actor_id:        options.userId,
      event_type:      eventType,
      entity_type:     'run',
      entity_id:       runId,
      summary,
      metadata: { workflow_id: options.workflowId, duration_ms: result.durationMs, node_count: result.logs.length },
    });
  }

  // ── Run details ────────────────────────────────────────────────────────────

  async getRun(runId: string, userId: string) {
    const { data: run, error } = await this.supabase.admin
      .from('execution_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error ?? !run) throw new NotFoundException(`Run ${runId} not found`);
    await this.assertMembership(run.organization_id as string, userId);
    return run;
  }

  async getRunLogs(runId: string, userId: string) {
    // Verify run access
    await this.getRun(runId, userId);

    const { data: logs, error } = await this.supabase.admin
      .from('execution_logs')
      .select('*')
      .eq('run_id', runId)
      .order('started_at', { ascending: true });

    if (error) throw new Error(error.message);
    return logs ?? [];
  }

  async listRunsForWorkflow(workflowId: string, userId: string) {
    const { data: workflow } = await this.supabase.admin
      .from('workflows')
      .select('project_id')
      .eq('id', workflowId)
      .maybeSingle();

    if (!workflow) throw new NotFoundException('Workflow not found');

    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', workflow.project_id as string)
      .maybeSingle();

    if (!project) throw new NotFoundException('Project not found');
    await this.assertMembership(project.organization_id as string, userId);

    const { data: runs, error } = await this.supabase.admin
      .from('execution_runs')
      .select('id, status, trigger_type, started_by, started_at, completed_at, duration_ms, error')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return runs ?? [];
  }

  /**
   * Get the most recent completed qs.read_boq output for a project.
   * Scans execution_logs for node_type = 'qs.read_boq' across all workflows
   * in the project.  Sprint 16 (S16-005).
   */
  async getLatestBoq(projectId: string, userId: string) {
    // Verify project access
    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle();
    if (!project) throw new NotFoundException('Project not found');
    await this.assertMembership(project.organization_id as string, userId);

    // Find most recent completed qs.read_boq node log for this project
    const { data, error } = await this.supabase.admin
      .from('execution_logs')
      .select('outputs, started_at, run_id, execution_runs!inner(workflow_id, workflows!inner(project_id))')
      .eq('node_type', 'qs.read_boq')
      .eq('status', 'completed')
      .eq('execution_runs.workflows.project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Phase 6: delegates to SecurityEngineService — enforces membership and role matrix */
  private async assertMembership(organizationId: string, userId: string): Promise<void> {
    await this.security.requireMembership(userId, organizationId);
  }

  // ── Event-triggered run (bypasses membership check) ───────────────────────

  /**
   * Called by EventBusService.dispatchSubscriptions() when a published event
   * matches an active subscription. Skips the human membership assertion because
   * the workflow was pre-validated at subscription creation time.
   */
  private async _triggerFromEvent(
    workflowId: string,
    orgId: string,
    actorId: string,
    inputs: Record<string, unknown>,
  ): Promise<void> {
    const { data: workflow } = await this.supabase.admin
      .from('workflows')
      .select('id, name, project_id, definition, published_version_id')
      .eq('id', workflowId)
      .single();

    if (!workflow?.['published_version_id']) return; // no published version — skip silently

    const { data: snap } = await this.supabase.admin
      .from('workflow_versions')
      .select('definition')
      .eq('id', workflow['published_version_id'] as string)
      .single();

    const definition = (snap?.['definition'] ?? workflow['definition']) as QSWorkflowDefinition;
    if (!definition?.nodes?.length) return;

    const { data: run } = await this.supabase.admin
      .from('execution_runs')
      .insert({
        workflow_id:       workflowId,
        project_id:        workflow['project_id'],
        organization_id:   orgId,
        workflow_snapshot: definition,
        status:            'running',
        trigger_type:      'event',
        inputs:            inputs ?? {},
        started_by:        actorId,
        started_at:        new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!run) return;

    const runId = run['id'] as string;

    void this.eventBus.publish({
      orgId,
      type:       'workflow.started',
      sourceType: 'workflow',
      sourceId:   workflowId,
      actorId,
      payload:    { runId, workflowName: workflow['name'], triggerType: 'event' },
    });

    // Phase 12: enqueue (falls back to in-process if Redis not available)
    // Phase 14: apply org-level node overrides to skipNodes on event-triggered runs
    const eventDisabledTypes = await this.packRegistry.getDisabledNodeTypes(orgId);
    const eventSkipNodes: SkipNodeSpec[] = eventDisabledTypes.size > 0
      ? definition.nodes
          .filter((n) => eventDisabledTypes.has(n.type as string))
          .map((n) => ({ nodeId: n.id as string, reason: `Node type "${n.type}" is disabled for this org` }))
      : [];

    if (this.executionQueue.isAvailable) {
      await this.executionQueue.enqueueTrigger({
        runId,
        workflowId,
        projectId:  workflow['project_id'] as string,
        orgId,
        userId:     actorId,
        skipNodes:  eventSkipNodes,
      });
    } else {
      const runOptions = {
        executionId:    runId,
        workflowId,
        projectId:      workflow['project_id'] as string,
        organizationId: orgId,
        userId:         actorId,
        definition,
        inputs:         inputs ?? {},
        variables:      {} as Record<string, unknown>,
        nodeResolver:   this.nodeResolver,
        skipNodes:      eventSkipNodes,
      };
      this._executeAndPersist(runId, workflow, { organization_id: orgId }, runOptions).catch(
        (err: unknown) => {
          console.error(
            `[ExecutionService] Event-triggered fallback run ${runId} threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      );
    }
  }

  // ── Direct node execution (inline actions) ─────────────────────────────────

  /**
   * Execute a single pack node directly — no workflow record required.
   *
   * Used by POST /resources/:id/execute-action so the /resources UI can trigger
   * real pack nodes (e.g. contractor.dispatch_trip) from inline action buttons
   * without requiring a pre-built, published workflow.
   *
   * Security: caller must be a member of orgId (enforced by JwtAuthGuard +
   * assertMembership). AI guardrails in each node are unchanged.
   */
  async executeNodeAction(
    nodeType: string,
    orgId: string,
    resourceId: string,
    inputs: Record<string, unknown>,
    actorId: string,
  ): Promise<{ status: string; outputs: Record<string, unknown>; error?: unknown }> {
    await this.assertMembership(orgId, actorId);

    const executor = this.nodeResolver(nodeType);
    if (!executor) {
      throw new BadRequestException(`Unknown node type: ${nodeType}`);
    }

    const ctx = {
      executionId:    `inline-${Date.now()}`,
      workflowId:     'inline-action',
      projectId:      'inline-action',
      organizationId: orgId,
      userId:         actorId,
      config:         {},
      inputs:         { resourceId, ...inputs },
      variables:      {},
      logger: {
        info:  (msg: string, data?: unknown) => console.log(`[NodeAction:${nodeType}] ${msg}`, data ?? ''),
        warn:  (msg: string, data?: unknown) => console.warn(`[NodeAction:${nodeType}] ${msg}`, data ?? ''),
        error: (msg: string, data?: unknown) => console.error(`[NodeAction:${nodeType}] ${msg}`, data ?? ''),
      },
    };

    try {
      const result = await executor(ctx);
      return {
        status:  result.status,
        outputs: result.outputs ?? {},
        ...(result.error ? { error: result.error } : {}),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ExecutionService] executeNodeAction(${nodeType}) threw: ${msg}`);
      return { status: 'failure', outputs: {}, error: { code: 'NODE_EXCEPTION', message: msg } };
    }
  }
}
