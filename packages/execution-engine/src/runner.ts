/**
 * @lados/execution-engine -- Workflow Runner
 *
 * Executes a workflow plan level by level (BFS wave order).
 * All steps within the same level have no inter-dependencies and run in parallel
 * via Promise.allSettled(). An optional concurrency semaphore caps simultaneous
 * node executions within a level.
 *
 * Sprint 6 (S6-002) -- in-process mock execution.
 * Sprint 7 (S7-005) -- real node resolver support (prefer real over mock).
 * Phase 6         -- parallel level execution + core.loop/parallel/merge support.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';
import type {
  RunnerOptions,
  ExecutionResult,
  ExecutionStep,
  NodeLogEntry,
  NodeRunStatus,
  RunStatus,
  SkipNodeSpec,
} from './types';
import { planWorkflow } from './graph-planner';
import { getMockExecutor } from './mock-registry';

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

// ── Concurrency semaphore ─────────────────────────────────────────────────────

/**
 * Simple semaphore that limits concurrent async tasks.
 * When limit is undefined or <= 0, all tasks run fully concurrently.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit?: number,
): Promise<PromiseSettledResult<T>[]> {
  if (!limit || limit <= 0 || limit >= tasks.length) {
    return Promise.allSettled(tasks.map((t) => t()));
  }

  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]!() };
      } catch (err) {
        results[idx] = { status: 'rejected', reason: err };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// -- Runner -------------------------------------------------------------------

export class WorkflowRunner {
  private options: RunnerOptions;
  private aborted = false;

  constructor(options: RunnerOptions) {
    this.options = options;
  }

  /** Abort mid-run (best-effort -- current level finishes) */
  abort() {
    this.aborted = true;
  }

  async run(): Promise<ExecutionResult> {
    const {
      definition,
      executionId,
      workflowId,
      projectId,
      organizationId,
      userId,
      inputs = {},
      variables = {},
      skipNodes = [],
      concurrency,
    } = this.options;

    // Build a fast lookup: nodeId -> SkipNodeSpec
    const skipMap = new Map<string, SkipNodeSpec>(skipNodes.map((s) => [s.nodeId, s]));
    const startedAt = new Date().toISOString();
    const logs: NodeLogEntry[] = [];

    // -- Plan -----------------------------------------------------------------
    const plan = planWorkflow(definition);

    if (plan.cycles.length > 0) {
      return {
        status: 'failed',
        outputs: {},
        logs,
        error: {
          code: 'CYCLE_DETECTED',
          message: `Workflow contains cycles: ${plan.cycles.map((c) => c.join(' -> ')).join('; ')}`,
        },
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
    }

    if (plan.parallelGroups.length === 0) {
      return {
        status: 'completed',
        outputs: {},
        logs,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
    }

    // -- Checkpoint restore (Phase 1 resume) ----------------------------------
    const resume = this.options.resumeFromCheckpoint;
    const nodeOutputs: Record<string, Record<string, unknown>> = resume
      ? { ...resume.checkpointOutputs }
      : {};
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

    // -- Execute levels in sequence; steps within each level run in parallel --
    levelLoop:
    for (const group of plan.parallelGroups) {
      if (this.aborted) {
        finalStatus = 'cancelled';
        break;
      }

      // Filter out already-completed steps (resume path)
      const pendingSteps = group.filter((step) => {
        if (resume && nodeOutputs[step.nodeId] !== undefined) {
          // Restore from checkpoint
          logs.push({
            nodeId:   step.nodeId,
            nodeType: step.nodeType,
            nodeName: step.nodeLabel,
            status:   'completed',
            outputs:  nodeOutputs[step.nodeId],
            messages: ['[RESUME] Restored from checkpoint'],
          });
          lastOutputs = nodeOutputs[step.nodeId] ?? {};
          return false;
        }
        return true;
      });

      if (pendingSteps.length === 0) continue;

      // Build parallel tasks for this level
      const levelTasks = pendingSteps.map((step) => () => this._executeStep(
        step, nodeOutputs, inputs, variables,
        { executionId, workflowId, projectId, organizationId, userId },
        skipMap,
      ));

      const settled = await runWithConcurrency(levelTasks, concurrency);

      // Collect results
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]!;   // safe: iterating within bounds
        const step = pendingSteps[i]!;

        if (result.status === 'rejected') {
          // Unhandled exception from _executeStep (shouldn't happen — it catches internally)
          const reason = String(result.reason as unknown);
          logs.push({
            nodeId:   step.nodeId,
            nodeType: step.nodeType,
            nodeName: step.nodeLabel,
            status:   'failed',
            messages: [`[ERROR] Unexpected task rejection: ${reason}`],
            error:    { code: 'TASK_REJECTED', message: reason },
          });
          finalStatus = 'failed';
          break levelLoop;
        } else {
          const { logEntry, nodeOutput, stepStatus } = result.value;
          logs.push(logEntry);

          if (stepStatus === 'paused') {
            pausedAtNodeId        = step.nodeId;
            pendingApprovalTaskId = logEntry.outputs?.['approval_task_id'] as string | undefined;
            finalStatus = 'paused';
            break levelLoop;
          }

          if (stepStatus === 'failed') {
            finalStatus = 'failed';
            break levelLoop;
          }

          // Success
          nodeOutputs[step.nodeId] = nodeOutput;
          lastOutputs = nodeOutput;
        }
      }

      if (finalStatus !== 'completed') break;
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
          messages: [
            finalStatus === 'paused'
              ? 'Waiting -- workflow paused for human approval'
              : 'Skipped due to earlier failure or cancellation',
          ],
        });
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs  =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();

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

  // -- Execute a single step ---------------------------------------------------

  private async _executeStep(
    step: ExecutionStep,
    nodeOutputs: Record<string, Record<string, unknown>>,
    workflowInputs: Record<string, unknown>,
    variables: Record<string, unknown>,
    ctx: {
      executionId?: string;
      workflowId: string;
      projectId: string;
      organizationId: string;
      userId: string;
    },
    skipMap: Map<string, SkipNodeSpec>,
  ): Promise<{
    logEntry: NodeLogEntry;
    nodeOutput: Record<string, unknown>;
    stepStatus: 'completed' | 'failed' | 'paused' | 'skipped';
  }> {
    // -- Skip nodes requested by AI trigger (Phase 11) ----------------------
    const skipSpec = skipMap.get(step.nodeId);
    if (skipSpec) {
      const skipOutputs = skipSpec.outputs ?? {};
      return {
        logEntry: {
          nodeId:   step.nodeId,
          nodeType: step.nodeType,
          nodeName: step.nodeLabel,
          status:   'skipped',
          outputs:  skipOutputs,
          messages: [
            `[SKIP] ${skipSpec.reason ?? 'Node skipped by AI workflow trigger'}`,
            `[SKIP] Injected outputs: ${JSON.stringify(skipOutputs)}`,
          ],
        },
        nodeOutput: skipOutputs,
        stepStatus: 'skipped',
      };
    }

    const nodeStartedAt = new Date().toISOString();
    const resolvedInputs = this._resolveInputs(step.nodeId, step.dependsOn, nodeOutputs, workflowInputs);

    const logEntry: NodeLogEntry = {
      nodeId:    step.nodeId,
      nodeType:  step.nodeType,
      nodeName:  step.nodeLabel,
      status:    'running' as NodeRunStatus,
      inputs:    resolvedInputs,
      messages:  [],
      startedAt: nodeStartedAt,
    };

    const nodeMessages: string[] = [];
    const nodeCtx: NodeContext = {
      nodeId:         step.nodeId,
      nodeType:       step.nodeType,
      upstream:       nodeOutputs,
      executionId:    ctx.executionId ?? `run-${Date.now()}`,
      workflowId:     ctx.workflowId,
      projectId:      ctx.projectId,
      organizationId: ctx.organizationId,
      userId:         ctx.userId,
      config:         step.config,
      inputs:         resolvedInputs,
      variables,
      logger: {
        info:  (msg: string) => nodeMessages.push(`[INFO]  ${msg}`),
        warn:  (msg: string) => nodeMessages.push(`[WARN]  ${msg}`),
        error: (msg: string) => nodeMessages.push(`[ERROR] ${msg}`),
      },
    };

    try {
      const realExecutor = this.options.nodeResolver?.(step.nodeType) ?? null;
      const executor: NodeExecutor = realExecutor ?? getMockExecutor(step.nodeType);
      const isReal = realExecutor !== null;
      nodeCtx.logger.info(`[${isReal ? 'REAL' : 'MOCK'}] Executing ${step.nodeType}`);

      const result = await executor(nodeCtx);
      const nodeCompletedAt = new Date().toISOString();
      const durationMs = new Date(nodeCompletedAt).getTime() - new Date(nodeStartedAt).getTime();

      nodeMessages.push(...(result.logs ?? []).map(String));
      logEntry.messages    = nodeMessages;
      logEntry.completedAt = nodeCompletedAt;
      logEntry.durationMs  = durationMs;
      logEntry.outputs     = result.outputs ?? {};

      // -- Phase 1: handle pause signal from human_approval -------------------
      if (result.status === 'paused') {
        logEntry.status = 'waiting';
        return { logEntry, nodeOutput: result.outputs ?? {}, stepStatus: 'paused' };
      }

      if (result.status === 'failure') {
        logEntry.status = 'failed';
        logEntry.error  = result.error ?? { code: 'NODE_FAILED', message: 'Node reported failure' };
        return { logEntry, nodeOutput: result.outputs ?? {}, stepStatus: 'failed' };
      }

      logEntry.status = 'completed';
      return { logEntry, nodeOutput: result.outputs ?? {}, stepStatus: 'completed' };

    } catch (err: unknown) {
      const nodeCompletedAt = new Date().toISOString();
      const durationMs = new Date(nodeCompletedAt).getTime() - new Date(nodeStartedAt).getTime();
      const message = err instanceof Error ? err.message : String(err);

      nodeMessages.push(`[ERROR] Unhandled exception: ${message}`);
      logEntry.status      = 'failed';
      logEntry.error       = { code: 'UNHANDLED_EXCEPTION', message };
      logEntry.messages    = nodeMessages;
      logEntry.completedAt = nodeCompletedAt;
      logEntry.durationMs  = durationMs;

      return { logEntry, nodeOutput: {}, stepStatus: 'failed' };
    }
  }

  // -- Private helpers -------------------------------------------------------

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
    Object.assign(merged, workflowInputs);
    return merged;
  }
}

/**
 * Convenience function -- create a runner and execute immediately.
 */
export async function runWorkflow(options: RunnerOptions): Promise<ExecutionResult> {
  const runner = new WorkflowRunner(options);
  return runner.run();
}
