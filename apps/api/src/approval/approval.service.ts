/**
 * ApprovalService — Phase 1 / Phase 5
 *
 * Manages human approval tasks: list pending, decide (approve/reject),
 * and delegate resume to ExecutionService.
 *
 * Phase 5 addition: when a task has data.pendingStateTransition (set by
 * the state.change workflow node's requires_approval guard), ApprovalService
 * calls StateEngineService.applyTransition() to complete the blocked resource
 * state change after the human approves.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { ExecutionService } from '../execution/execution.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { StateEngineService } from '../state-engine/state-engine.service';
import { SecurityEngineService } from '../security/security.service';
import { ApprovalTaskCreator } from './approval-task.creator';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly executionService: ExecutionService,
    private readonly eventBus: EventBusService,
    private readonly stateEngine: StateEngineService,
    private readonly security: SecurityEngineService,
    private readonly taskCreator: ApprovalTaskCreator,
  ) {}

  /**
   * Phase 7 — IApprovalTaskService implementation.
   * Delegates to ApprovalTaskCreator (no circular dep with ExecutionService).
   * Called by foundation.request_approval workflow node.
   */
  async createTask(params: {
    executionId:  string;
    workflowId:   string;
    projectId:    string;
    nodeId:       string;
    nodeName?:    string;
    orgId:        string;
    title:        string;
    description?: string;
    assigneeRole?: string;
    data?:        Record<string, unknown>;
  }): Promise<{ taskId: string }> {
    return this.taskCreator.createTask(params);
  }

  /** List all pending approval tasks for the current user's organisations */
  async listPending(userId: string) {
    // Get all orgs the user belongs to
    const { data: memberships } = await this.supabase.admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);

    const orgIds = (memberships ?? []).map((m) => m.organization_id as string);
    if (orgIds.length === 0) return [];

    const { data: tasks, error } = await this.supabase.admin
      .from('approval_tasks')
      .select(`
        id, title, description, data, status, assignee_role,
        created_at, node_id, node_name,
        execution_id, workflow_id, project_id,
        execution_runs!inner ( organization_id, status )
      `)
      .eq('status', 'pending')
      .in('execution_runs.organization_id', orgIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return tasks ?? [];
  }

  /** List all approval tasks for a specific run */
  async listForRun(runId: string, userId: string) {
    const { data: run } = await this.supabase.admin
      .from('execution_runs')
      .select('organization_id')
      .eq('id', runId)
      .single();

    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    await this.assertMembership(run.organization_id as string, userId);

    const { data: tasks, error } = await this.supabase.admin
      .from('approval_tasks')
      .select('*')
      .eq('execution_id', runId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return tasks ?? [];
  }

  /** Get a single approval task */
  async getTask(taskId: string, userId: string) {
    const { data: task, error } = await this.supabase.admin
      .from('approval_tasks')
      .select(`
        *,
        execution_runs!inner ( organization_id, status, paused_at_node_id )
      `)
      .eq('id', taskId)
      .single();

    if (error || !task) throw new NotFoundException(`Approval task ${taskId} not found`);
    const orgId = (task as { execution_runs: { organization_id: string } }).execution_runs.organization_id;
    await this.assertMembership(orgId, userId);
    return task;
  }

  /** Approve or reject an approval task, then resume the paused run */
  async decide(
    taskId: string,
    decision: 'approved' | 'rejected',
    comments: string,
    userId: string,
  ) {
    const task = await this.getTask(taskId, userId);

    if (task['status'] !== 'pending') {
      throw new BadRequestException(`Approval task is already ${task['status']}`);
    }

    const orgId = task['execution_runs']?.['organization_id'] as string | undefined;

    // Phase 5: complete a blocked resource state transition if this task was
    // created by the state.change workflow node's requires_approval guard.
    const pending = (task['data'] as Record<string, unknown> | null)?.['pendingStateTransition'] as {
      resourceId:   string;
      resourceType: string;
      fromState:    string;
      toState:      string;
      orgId:        string;
    } | undefined;

    if (pending && decision === 'approved') {
      await this.stateEngine.applyTransition({
        resourceId: pending.resourceId,
        orgId:      pending.orgId ?? orgId ?? '',
        fromState:  pending.fromState,
        toState:    pending.toState,
        actorId:    userId,
      });
    }

    // Resume the workflow execution
    const result = await this.executionService.resumeRun(
      task['execution_id'] as string,
      taskId,
      decision === 'approved',
      comments,
      userId,
    );

    if (orgId) {
      void this.eventBus.publish({
        orgId,
        type: decision === 'approved' ? 'approval.approved' : 'approval.rejected',
        sourceType: 'approval',
        sourceId: taskId,
        actorId: userId,
        payload: {
          taskId,
          executionId: task['execution_id'],
          decision,
          comments,
          ...(pending && { pendingStateTransition: pending }),
        },
      });
    }

    return result;
  }

  /** Phase 6: delegates to SecurityEngineService */
  private async assertMembership(organizationId: string, userId: string): Promise<void> {
    await this.security.requireMembership(userId, organizationId);
  }
}
