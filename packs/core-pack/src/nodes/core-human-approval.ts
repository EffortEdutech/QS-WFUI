/**
 * Real implementation: core.human_approval
 *
 * Phase 1 behaviour:
 *   - Creates an approval_tasks row with status = 'pending'.
 *   - Sends a notification with a direct link to the approval inbox.
 *   - Returns { status: 'paused' } so the WorkflowRunner halts here.
 *   - Execution resumes only after a human calls POST /approvals/:taskId/decide.
 *
 * Security: AI must not approve, certify, or decide entitlement.
 *           Only a human reviewer can resolve an approval node.
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import { createClient } from '@supabase/supabase-js';

/** Mirror of NotificationType from apps/api — kept in sync manually. */
type NotificationType =
  | 'approval_request'
  | 'execution_complete'
  | 'execution_failed'
  | 'data_pack_update'
  | 'quota_warning'
  | 'system';

/** Minimal interface — NestJS NotificationService satisfies this via duck typing. */
export interface INotificationService {
  notify(payload: {
    userId: string;
    orgId?: string;
    type: NotificationType;
    title: string;
    body?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null>;
}

export async function realHumanApproval(
  ctx: NodeContext,
  notificationService?: INotificationService,
): Promise<NodeExecuteResult> {
  const title        = (ctx.config['title'] as string | undefined) ?? 'Approve Workflow Step';
  const assigneeRole = (ctx.config['assignee_role'] as string | undefined) ?? 'owner';
  const description  = (ctx.config['description'] as string | undefined) ?? '';

  ctx.logger.info(`Human Approval: "${title}" — creating pending task for role: ${assigneeRole}`);

  const supabaseUrl = process.env['SUPABASE_URL']!;
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;

  if (!supabaseUrl || !supabaseKey) {
    ctx.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot create approval task');
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: { code: 'APPROVAL_CONFIG_ERROR', message: 'Supabase credentials not configured' },
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: task, error } = await supabase
    .from('approval_tasks')
    .insert({
      execution_id:  ctx.executionId,
      workflow_id:   ctx.workflowId,
      project_id:    ctx.projectId,
      node_id:       ctx.config['_node_id'] ?? 'unknown',
      node_name:     title,
      title,
      description:   description || `Review required by ${assigneeRole}`,
      data:          ctx.inputs,
      status:        'pending',
      assignee_role: assigneeRole,
    })
    .select('id')
    .single();

  if (error || !task) {
    ctx.logger.error(`Failed to create approval task: ${error?.message ?? 'unknown error'}`);
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: { code: 'APPROVAL_INSERT_FAILED', message: error?.message ?? 'DB insert failed' },
    };
  }

  const approvalTaskId = task.id as string;
  ctx.logger.info(`Approval task created: ${approvalTaskId} — workflow will pause until decision`);

  // Notify the assignee
  if (notificationService && ctx.userId) {
    const approvalUrl = `/approvals?runId=${ctx.executionId}&taskId=${approvalTaskId}`;

    await notificationService.notify({
      userId:    ctx.userId,
      type:      'approval_request',
      title:     `Action Required: ${title}`,
      body:      description || `A workflow step is waiting for your approval. Click to review and decide.`,
      actionUrl: approvalUrl,
      metadata:  {
        workflowId:     ctx.workflowId,
        executionId:    ctx.executionId,
        approvalTaskId,
      },
    }).catch((err: unknown) => {
      ctx.logger.warn(`Notification failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // Signal the runner to pause — execution halts here until resumeRun() is called
  return {
    status:  'paused',
    outputs: {
      approval_task_id: approvalTaskId,
      assignee_role:    assigneeRole,
      pending:          true,
    },
    logs: [],
    summary: `Paused: waiting for human approval — "${title}"`,
  };
}
