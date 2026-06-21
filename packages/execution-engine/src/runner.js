"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowRunner = void 0;
exports.runWorkflow = runWorkflow;
const graph_planner_1 = require("./graph-planner");
const mock_registry_1 = require("./mock-registry");
class WorkflowRunner {
    options;
    aborted = false;
    constructor(options) {
        this.options = options;
    }
    abort() {
        this.aborted = true;
    }
    async run() {
        const { definition, executionId, workflowId, projectId, organizationId, userId, inputs = {}, variables = {} } = this.options;
        const startedAt = new Date().toISOString();
        const logs = [];
        const plan = (0, graph_planner_1.planWorkflow)(definition);
        if (plan.cycles.length > 0) {
            return {
                status: 'failed',
                outputs: {},
                logs,
                error: {
                    code: 'CYCLE_DETECTED',
                    message: `Workflow contains cycles: ${plan.cycles.map((c) => c.join(' → ')).join('; ')}`,
                },
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs: 0,
            };
        }
        if (plan.steps.length === 0) {
            return {
                status: 'completed',
                outputs: {},
                logs,
                startedAt,
                completedAt: new Date().toISOString(),
                durationMs: 0,
            };
        }
        const resume = this.options.resumeFromCheckpoint;
        const nodeOutputs = resume
            ? { ...resume.checkpointOutputs }
            : {};
        if (resume) {
            nodeOutputs[resume.pausedAtNodeId] = {
                approved: resume.approvalResult.approved,
                rejected: resume.approvalResult.rejected,
                comments: resume.approvalResult.comments,
                approval_task_id: resume.approvalResult.approvalTaskId,
                approver_role: 'human',
            };
        }
        let lastOutputs = inputs;
        let finalStatus = 'completed';
        let pausedAtNodeId;
        let pendingApprovalTaskId;
        for (const step of plan.steps) {
            if (this.aborted) {
                finalStatus = 'cancelled';
                break;
            }
            if (resume && nodeOutputs[step.nodeId] !== undefined) {
                logs.push({
                    nodeId: step.nodeId,
                    nodeType: step.nodeType,
                    nodeName: step.nodeLabel,
                    status: 'completed',
                    outputs: nodeOutputs[step.nodeId],
                    messages: ['[RESUME] Restored from checkpoint'],
                });
                lastOutputs = nodeOutputs[step.nodeId];
                continue;
            }
            const nodeStartedAt = new Date().toISOString();
            const logEntry = {
                nodeId: step.nodeId,
                nodeType: step.nodeType,
                nodeName: step.nodeLabel,
                status: 'running',
                inputs: this._resolveInputs(step.nodeId, step.dependsOn, nodeOutputs, inputs),
                messages: [],
                startedAt: nodeStartedAt,
            };
            const nodeMessages = [];
            const ctx = {
                executionId: executionId ?? `run-${Date.now()}`,
                workflowId,
                projectId,
                organizationId,
                userId,
                config: step.config,
                inputs: logEntry.inputs ?? {},
                variables,
                logger: {
                    info: (msg) => nodeMessages.push(`[INFO]  ${msg}`),
                    warn: (msg) => nodeMessages.push(`[WARN]  ${msg}`),
                    error: (msg) => nodeMessages.push(`[ERROR] ${msg}`),
                },
            };
            try {
                const realExecutor = this.options.nodeResolver?.(step.nodeType) ?? null;
                const executor = realExecutor ?? (0, mock_registry_1.getMockExecutor)(step.nodeType);
                const isReal = realExecutor !== null;
                ctx.logger.info(`[${isReal ? 'REAL' : 'MOCK'}] Executing ${step.nodeType}`);
                const result = await executor(ctx);
                const nodeCompletedAt = new Date().toISOString();
                const durationMs = new Date(nodeCompletedAt).getTime() - new Date(nodeStartedAt).getTime();
                nodeMessages.push(...(result.logs ?? []).map(String));
                if (result.status === 'paused') {
                    pausedAtNodeId = step.nodeId;
                    pendingApprovalTaskId = result.outputs?.['approval_task_id'];
                    logEntry.status = 'waiting';
                    logEntry.outputs = result.outputs ?? {};
                    logEntry.messages = nodeMessages;
                    logEntry.completedAt = nodeCompletedAt;
                    logEntry.durationMs = durationMs;
                    logs.push(logEntry);
                    finalStatus = 'paused';
                    break;
                }
                if (result.status === 'failure') {
                    logEntry.status = 'failed';
                    logEntry.error = result.error ?? { code: 'NODE_FAILED', message: 'Node reported failure' };
                    logEntry.outputs = result.outputs ?? {};
                    logEntry.messages = nodeMessages;
                    logEntry.completedAt = nodeCompletedAt;
                    logEntry.durationMs = durationMs;
                    logs.push(logEntry);
                    finalStatus = 'failed';
                    break;
                }
                nodeOutputs[step.nodeId] = result.outputs ?? {};
                lastOutputs = result.outputs ?? {};
                logEntry.status = 'completed';
                logEntry.outputs = result.outputs ?? {};
                logEntry.messages = nodeMessages;
                logEntry.completedAt = nodeCompletedAt;
                logEntry.durationMs = durationMs;
                logs.push(logEntry);
            }
            catch (err) {
                const nodeCompletedAt = new Date().toISOString();
                const durationMs = new Date(nodeCompletedAt).getTime() - new Date(nodeStartedAt).getTime();
                const message = err instanceof Error ? err.message : String(err);
                nodeMessages.push(`[ERROR] Unhandled exception: ${message}`);
                logEntry.status = 'failed';
                logEntry.error = { code: 'UNHANDLED_EXCEPTION', message };
                logEntry.messages = nodeMessages;
                logEntry.completedAt = nodeCompletedAt;
                logEntry.durationMs = durationMs;
                logs.push(logEntry);
                finalStatus = 'failed';
                break;
            }
        }
        const executedNodeIds = new Set(logs.map((l) => l.nodeId));
        for (const step of plan.steps) {
            if (!executedNodeIds.has(step.nodeId)) {
                logs.push({
                    nodeId: step.nodeId,
                    nodeType: step.nodeType,
                    nodeName: step.nodeLabel,
                    status: finalStatus === 'paused' ? 'waiting' : 'skipped',
                    messages: [finalStatus === 'paused'
                            ? 'Waiting — workflow paused for human approval'
                            : 'Skipped due to earlier failure or cancellation'],
                });
            }
        }
        const completedAt = new Date().toISOString();
        const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
        return {
            status: finalStatus,
            outputs: lastOutputs,
            logs,
            startedAt,
            completedAt,
            durationMs,
            ...(finalStatus === 'paused' && {
                pausedAtNodeId,
                checkpointOutputs: nodeOutputs,
                pendingApprovalTaskId,
            }),
        };
    }
    _resolveInputs(_nodeId, dependsOn, nodeOutputs, workflowInputs) {
        if (dependsOn.length === 0)
            return workflowInputs;
        const merged = {};
        for (const depId of dependsOn) {
            const depOutputs = nodeOutputs[depId] ?? {};
            Object.assign(merged, depOutputs);
        }
        Object.assign(merged, workflowInputs);
        return merged;
    }
}
exports.WorkflowRunner = WorkflowRunner;
async function runWorkflow(options) {
    const runner = new WorkflowRunner(options);
    return runner.run();
}
//# sourceMappingURL=runner.js.map