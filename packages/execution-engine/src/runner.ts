/**
 * @lados/execution-engine — Workflow Runner
 *
 * Executes a workflow plan sequentially, node by node.
 * Writes status + log entries for each step.
 * Sprint 6 (S6-002) — in-process mock execution.
 * Sprint 7 (S7-005) — real node resolver support (prefer real over mock).
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';
import type {
  RunnerOptions,
  ExecutionResult,
  NodeLogEntry,
  NodeRunStatus,
  RunStatus,
} from './types';
import { planWorkflow } from './graph-planner';
import { getMockExecutor } from './mock-registry';

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

// ── Runner ────────────────────────────────────────────────────────────────────

export class WorkflowRunner {
  private options: RunnerOptions;
  private aborted = false;

  constructor(options: RunnerOptions) {
    this.options = options;
  }

  /** Abort mid-run (best-effort — current node finishes) */
  abort() {
    this.aborted = true;
  }

  async run(): Promise<ExecutionResult> {
    const { definition, executionId, workflowId, projectId, organizationId, userId, inputs = {}, variables = {} } = this.options;
    const startedAt = new Date().toISOString();
    const logs: NodeLogEntry[] = [];

    // ── Plan ───────────────────────────────────────────────────────────────
    const plan = planWorkflow(definition);

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

    // ── Checkpoint restore (Phase 1 resume) ───────────────────────────────
    const resume = this.options.resumeFromCheckpoint;
    // Pre-seed nodeOutputs with everything completed before the pause
    const nodeOutputs: Record<string, Record<string, unknown>> = resume
      ? { ...resume.checkpointOutputs }
      : {};
    // If resuming, inject the approval decision as the paused node's output
    if (resume) {
      nodeOutputs[resume.pausedAtNodeId] = {
        approved:         resume.approvalResult.approved,
        rejected:         resume.approvalResult.rejected,
        comments:         resume.approvalResult.comments,
        approval_task_id: resume.approvalResult.approvalTaskId,
        approver_role:    'human',
      };
    }

    let lastOutputs: Record<string, unknown> = inputs;
    let finalStatus: RunStatus = 'completed';
    let pausedAtNodeId: string | undefined;
    let pendingApprovalTaskId: string | undefined;

    // ── Execute steps sequentially ─────────────────────────────────────────
    for (const step of plan.steps) {
      if (this.aborted) {
        finalStatus = 'cancelled';
        break;
      }

      // ── Skip nodes already completed in a prior run (resume path) ────────
      if (resume && nodeOutputs[step.nodeId] !== undefined) {
        logs.push({
          nodeId:   step.nodeId,
          nodeType: step.nodeType,
          nodeName: step.nodeLabel,
          status:   'completed',
          outputs:  nodeOutputs[step.nodeId],
          messages: ['[RESUME] Restored from checkpoint'],
        });
        lastOutputs = nodeOutputs[step.nodeId];
        continue;
      }

      const nodeStartedAt = new Date().toISOString();
      const logEntry: NodeLogEntry = {
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        nodeName: step.nodeLabel,
        status: 'running' as NodeRunStatus,
        inputs: this._resolveInputs(step.nodeId, step.dependsOn, nodeOutputs, inputs),
        messages: [],
        startedAt: nodeStartedAt,
      };

      // Build NodeContext
      const nodeMessages: string[] = [];
      const ctx: NodeContext = {
        executionId: executionId ?? `run-${Date.now()}`,
        workflowId,
        projectId,
        organizationId,
        userId,
        config: step.config,
        inputs: logEntry.inputs ?? {},
        variables,
        logger: {
          info:  (msg: string) => nodeMessages.push(`[INFO]  ${msg}`),
          warn:  (msg: string) => nodeMessages.push(`[WARN]  ${msg}`),
          error: (msg: string) => nodeMessages.push(`[ERROR] ${msg}`),
        },
      };

      try {
        // Prefer real implementation when available, fall back to mock
        const realExecutor = this.options.nodeResolver?.(step.nodeType) ?? null;
        const executor: NodeExecutor = realExecutor ?? getMockExecutor(step.nodeType);
        const isReal = realExecutor !== null;
        ctx.logger.info(`[${isReal ? 'REAL' : 'MOCK'}] Executing ${step.nodeType}`);
        const result = await executor(ctx);

        const nodeCompletedAt = new Date().toISOString();
        const durationMs = new Date(nodeCompletedAt).getTime() - new Date(nodeStartedAt).getTime();

        nodeMessages.push(...(result.logs ?? []).map(String));

        // ── Phase 1: handle pause signal from human_approval ─────────────
        if (result.status === 'paused') {
          pausedAtNodeId        = step.nodeId;
          pendingApprovalTaskId = result.outputs?.['approval_task_id'] as string | undefined;
          logEntry.status       = 'waiting';
          logEntry.outputs      = result.outputs ?? {};
          logEntry.messages     = nodeMessages;
          logEntry.completedAt  = nodeCompletedAt;
          logEntry.durationMs   = durationMs;
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

        // Success
        nodeOutputs[step.nodeId] = result.outputs ?? {};
        lastOutputs = result.outputs ?? {};

        logEntry.status = 'completed';
        logEntry.outputs = result.outputs ?? {};
        logEntry.messages = nodeMessages;
        logEntry.completedAt = nodeCompletedAt;
        logEntry.durationMs = durationMs;
        logs.push(logEntry);

      } catch (err: unknown) {
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

    // Mark remaining nodes: skipped (failure/cancel) or waiting (paused)
    const executedNodeIds = new Set(logs.map((l) => l.nodeId));
    for (const step of plan.steps) {
      if (!executedNodeIds.has(step.nodeId)) {
        logs.push({
          nodeId:   step.nodeId,
          nodeType: step.nodeType,
          nodeName: step.nodeLabel,
          status:   finalStatus === 'paused' ? 'waiting' : 'skipped',
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

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Merge outputs from all dependency nodes to form this node's inputs.
   * If a node has no dependencies, it receives the workflow-level inputs.
   */
  private _resolveInputs(
    _nodeId: string,
    dependsOn: string[],
    nodeOutputs: Record<string, Record<string, unknown>>,
    workflowInputs: Record<string, unknown>,
  ): Record<string, unknown> {
    if (dependsOn.length === 0) return workflowInputs;

    const merged: Record<string, unknown> = {};
    for (const depId of dependsOn) {
      const depOutputs = nodeOutputs[depId] ?? {};
      Object.assign(merged, depOutputs);
    }
    // Also include top-level workflow inputs (e.g. file_id passed from UI)
    Object.assign(merged, workflowInputs);
    return merged;
  }
}

/**
 * Convenience function — create a runner and execute immediately.
 */
export async function runWorkflow(options: RunnerOptions): Promise<ExecutionResult> {
  const runner = new WorkflowRunner(options);
  return runner.run();
}
