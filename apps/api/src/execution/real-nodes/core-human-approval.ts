/**
 * Real implementation: core.human_approval
 *
 * MVP behaviour (Sprint 10):
 *   - Records an approval_tasks row in the DB capturing the data under review.
 *   - Auto-approves immediately for demo purposes (no blocking pause).
 *   - Outputs approved:true, comments, and the approval_task_id for audit.
 *
 * The approval record is visible in the audit trail and the UI panel.
 *
 * Future: replace auto-approve with a pause + resume webhook so the workflow
 * genuinely halts until a human clicks Approve in the UI.
 *
 * Security: AI must not approve, certify, or decide entitlement.
 *           Human approval nodes are for human reviewers only.
 */
import type { NodeContext, NodeExecuteResult } from '@qsos/execution-engine';
import { createClient } from '@supabase/supabase-js';

export async function realHumanApproval(ctx: NodeContext): Promise<NodeExecuteResult> {
  const title         = (ctx.config['title'] as string | undefined) ?? 'Approve Workflow Step';
  const assigneeRole  = (ctx.config['assignee_role'] as string | undefined) ?? 'owner';
  const description   = (ctx.config['description'] as string | undefined) ?? '';

  // Data snapshot to display to the approver
  const data = ctx.inputs;

  ctx.logger.info(`Human Approval: "${title}" — recording task for role: ${assigneeRole}`);

  // Persist approval_task row
  const supabaseUrl  = process.env.SUPABASE_URL!;
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase     = createClient(supabaseUrl, supabaseKey);

  let approvalTaskId: string | null = null;

  if (supabaseUrl && supabaseKey) {
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
        data:          data,
        status:        'auto_approved',    // MVP: auto-approve
        assignee_role: assigneeRole,
        decided_by:    ctx.userId ?? null,
        decision_at:   new Date().toISOString(),
        comments:      'Auto-approved by system (MVP demo mode). Human review required in production.',
      })
      .select('id')
      .single();

    if (error) {
      ctx.logger.warn(`Could not persist approval task: ${error.message}`);
    } else {
      approvalTaskId = task?.id ?? null;
      ctx.logger.info(`Approval task recorded: ${approvalTaskId}`);
    }
  } else {
    ctx.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — approval task not persisted');
  }

  ctx.logger.info(
    `✅ Auto-approved (demo mode) — production deployment requires human decision before this node completes.`,
  );

  return {
    status: 'success',
    outputs: {
      approved:         true,
      rejected:         false,
      comments:         'Auto-approved (demo mode)',
      approval_task_id: approvalTaskId,
      approver_role:    assigneeRole,
    },
    logs: [],
    summary: `Auto-approved: "${title}"`,
  };
}
