"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realHumanApproval = realHumanApproval;
const supabase_js_1 = require("@supabase/supabase-js");
async function realHumanApproval(ctx, notificationService) {
    const title = ctx.config['title'] ?? 'Approve Workflow Step';
    const assigneeRole = ctx.config['assignee_role'] ?? 'owner';
    const description = ctx.config['description'] ?? '';
    ctx.logger.info(`Human Approval: "${title}" — creating pending task for role: ${assigneeRole}`);
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!supabaseUrl || !supabaseKey) {
        ctx.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot create approval task');
        return {
            status: 'failure',
            outputs: {},
            logs: [],
            error: { code: 'APPROVAL_CONFIG_ERROR', message: 'Supabase credentials not configured' },
        };
    }
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    const { data: task, error } = await supabase
        .from('approval_tasks')
        .insert({
        execution_id: ctx.executionId,
        workflow_id: ctx.workflowId,
        project_id: ctx.projectId,
        node_id: ctx.config['_node_id'] ?? 'unknown',
        node_name: title,
        title,
        description: description || `Review required by ${assigneeRole}`,
        data: ctx.inputs,
        status: 'pending',
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
    const approvalTaskId = task.id;
    ctx.logger.info(`Approval task created: ${approvalTaskId} — workflow will pause until decision`);
    if (notificationService && ctx.userId) {
        const approvalUrl = `/approvals?runId=${ctx.executionId}&taskId=${approvalTaskId}`;
        await notificationService.notify({
            userId: ctx.userId,
            type: 'approval_request',
            title: `Action Required: ${title}`,
            body: description || `A workflow step is waiting for your approval. Click to review and decide.`,
            actionUrl: approvalUrl,
            metadata: {
                workflowId: ctx.workflowId,
                executionId: ctx.executionId,
                approvalTaskId,
            },
        }).catch((err) => {
            ctx.logger.warn(`Notification failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
    return {
        status: 'paused',
        outputs: {
            approval_task_id: approvalTaskId,
            assignee_role: assigneeRole,
            pending: true,
        },
        logs: [],
        summary: `Paused: waiting for human approval — "${title}"`,
    };
}
//# sourceMappingURL=core-human-approval.js.map