/**
 * foundation.request_approval
 *
 * Canonical workflow node for requesting human approval.
 * Supersedes core.human_approval (kept for backward compatibility).
 *
 * Differences from core.human_approval:
 *   - Uses a proper IApprovalTaskService interface (cleaner than direct Supabase)
 *   - Accepts structured `data` passthrough (for state transition metadata, etc.)
 *   - Accepts `notifyUserId` to explicitly target the notified reviewer
 *   - More descriptive outputs
 *
 * Inputs (config or dynamic):
 *   title         — approval task title (required)
 *   description   — task description (optional)
 *   assigneeRole  — which org role should action this (default: 'owner')
 *   notifyUserId  — user to notify immediately (optional, falls back to ctx.userId)
 *   data          — arbitrary payload attached to the task (optional)
 *
 * Outputs (before pause):
 *   approvalTaskId  — UUID of the created approval_tasks row
 *   assigneeRole    — role that must decide
 *   pending         — true
 *
 * Returns { status: 'paused' } — WorkflowRunner halts execution here.
 * Resumes only after POST /approvals/:taskId/decide with approved=true|false.
 *
 * AI guardrail (non-negotiable):
 *   AI must not call this node's decide endpoint. Only humans with owner|admin
 *   role may resolve approval tasks. This is enforced at the SecurityEngine layer.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { INotificationService } from './foundation-send-notification';

// ── Service interface ─────────────────────────────────────────────────────────

/**
 * Minimal interface satisfied by NestJS ApprovalService via duck typing.
 * Only the createTask operation is needed by this node.
 */
export interface IApprovalTaskService {
  createTask(params: {
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
  }): Promise<{ taskId: string }>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realRequestApproval(
  ctx: NodeContext,
  approvalService?: IApprovalTaskService,
  notificationService?: INotificationService,
): Promise<NodeExecuteResult> {
  if (!approvalService) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'NO_SERVICE', message: 'ApprovalTaskService not injected' },
    };
  }

  const title        = (ctx.inputs['title']        ?? ctx.config['title'])        as string | undefined;
  const description  = (ctx.inputs['description']  ?? ctx.config['description'])  as string | undefined;
  const assigneeRole = (ctx.inputs['assigneeRole'] ?? ctx.config['assigneeRole'] ?? 'owner') as string;
  const notifyUserId = (ctx.inputs['notifyUserId'] ?? ctx.config['notifyUserId'] ?? ctx.userId) as string | undefined;
  const data         = (ctx.inputs['data']         ?? ctx.config['data'])         as Record<string, unknown> | undefined;

  if (!title) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'MISSING_INPUT', message: 'title is required' },
    };
  }

  ctx.logger.info(`foundation.request_approval: "${title}" — assigneeRole:${assigneeRole}`);

  const { taskId } = await approvalService.createTask({
    executionId:  ctx.executionId,
    workflowId:   ctx.workflowId,
    projectId:    ctx.projectId ?? '',
    nodeId:       (ctx.config['_node_id'] as string | undefined) ?? 'unknown',
    nodeName:     title,
    orgId:        ctx.organizationId ?? '',
    title,
    description:  description ?? `Review required by ${assigneeRole}`,
    assigneeRole,
    data:         { ...ctx.inputs, ...(data ?? {}) },
  });

  ctx.logger.info(`Approval task created: ${taskId} — pausing workflow`);

  // Notify the assignee (fire-and-forget — failure does not block the pause)
  if (notificationService && notifyUserId) {
    const actionUrl = `/approvals?runId=${ctx.executionId}&taskId=${taskId}`;
    notificationService.notify({
      userId:    notifyUserId,
      orgId:     ctx.organizationId,
      type:      'approval_request',
      title:     `Action Required: ${title}`,
      body:      description ?? `A workflow step is waiting for your approval. Click to review and decide.`,
      actionUrl,
      metadata:  { workflowId: ctx.workflowId, executionId: ctx.executionId, approvalTaskId: taskId },
    }).catch((err: unknown) => {
      ctx.logger.warn(`Notification failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  return {
    status:  'paused',
    outputs: {
      approvalTaskId: taskId,
      assigneeRole,
      pending: true,
    },
    summary: `Paused: waiting for human approval — "${title}"`,
  };
}
