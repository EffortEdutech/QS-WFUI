/**
 * @lados/execution-engine — Core types
 * Sprint 6 (S6-002)
 */

import type { QSWorkflowDefinition } from '@lados/shared-types';
import type { NodeContext, NodeExecuteResult, NodeLogger } from '@lados/node-sdk';

// ── Re-export NodeContext so callers only import from execution-engine ────────
export type { NodeContext, NodeExecuteResult, NodeLogger };

// ── Execution states ─────────────────────────────────────────────────────────

export type RunStatus =
  | 'created' | 'queued' | 'validating' | 'planning'
  | 'running' | 'waiting' | 'paused' | 'retrying'
  | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export type NodeRunStatus =
  | 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

// ── Execution plan ────────────────────────────────────────────────────────────

export interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  config: Record<string, unknown>;
  /** IDs of steps that must complete before this one */
  dependsOn: string[];
  /**
   * Phase 6: BFS wave index (0-based).
   * All steps at the same level have no dependencies on each other
   * and can execute in parallel.
   */
  level: number;
}

export interface ExecutionPlan {
  /** Ordered list of steps (topological sort) */
  steps: ExecutionStep[];
  /**
   * Phase 6: Steps grouped by BFS level.
   * Each group is a set of steps that can run in parallel.
   * parallelGroups[0] are root nodes, parallelGroups[1] depend only on level-0, etc.
   */
  parallelGroups: ExecutionStep[][];
  /** Detected cycles — if any, execution is blocked */
  cycles: string[][];
}

// ── Node log entry ────────────────────────────────────────────────────────────

export interface NodeLogEntry {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: NodeRunStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
  messages: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

// ── Execution result ──────────────────────────────────────────────────────────

export interface ExecutionResult {
  status: RunStatus;
  /** Final outputs from the last node */
  outputs: Record<string, unknown>;
  /** Per-node log entries */
  logs: NodeLogEntry[];
  error?: { code: string; message: string };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  /**
   * Phase 1: set when status === 'paused'.
   * The node ID at which execution halted awaiting human input.
   */
  pausedAtNodeId?: string;
  /**
   * Phase 1: set when status === 'paused'.
   * Accumulated outputs of all nodes that ran before the pause point.
   * Used by resumeRun() to skip already-completed nodes.
   */
  checkpointOutputs?: Record<string, Record<string, unknown>>;
  /**
   * Phase 1: set when status === 'paused'.
   * The approval_tasks.id that must be decided before the run can resume.
   */
  pendingApprovalTaskId?: string;
}

// ── Resume checkpoint ─────────────────────────────────────────────────────────

export interface ResumeCheckpoint {
  /** Node ID at which execution was paused */
  pausedAtNodeId: string;
  /** Outputs from all nodes that ran before the pause */
  checkpointOutputs: Record<string, Record<string, unknown>>;
  /** The approval decision injected as that node's output */
  approvalResult: {
    approved: boolean;
    rejected: boolean;
    comments: string;
    approvalTaskId: string;
    decidedBy: string;
  };
}

// ── Skip node spec ────────────────────────────────────────────────────────────

/**
 * Specifies a node that should be skipped at execution time.
 * Used by the AI workflow trigger to bypass optional nodes
 * (e.g. "create customer" when the customer already exists).
 *
 * `outputs` are injected as if the node had run — downstream nodes
 * that depend on this node's outputs will receive them normally.
 */
export interface SkipNodeSpec {
  nodeId:   string;
  /** Outputs to inject — used by downstream nodes as if the node had run */
  outputs?: Record<string, unknown>;
  /** Human-readable reason shown in the execution log */
  reason?:  string;
}

// ── Runner options ────────────────────────────────────────────────────────────

export interface RunnerOptions {
  /** Actual DB run ID (UUID) — pass from ExecutionService so real nodes can write audit rows */
  executionId?: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  definition: QSWorkflowDefinition;
  inputs?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  /**
   * Sprint 7: Optional resolver that returns a REAL node executor.
   * If it returns null for a given nodeType, the runner falls back to mock.
   * Inject from NestJS context to give nodes access to DB/Storage services.
   */
  nodeResolver?: (nodeType: string) => ((ctx: NodeContext) => Promise<NodeExecuteResult>) | null;
  /**
   * Phase 1: When set, the runner resumes from a paused approval node
   * instead of starting from scratch.
   */
  resumeFromCheckpoint?: ResumeCheckpoint;
  /**
   * Phase 11: AI-requested node skips.
   * Each spec names a node to skip and provides the outputs to inject
   * so downstream nodes still receive the data they expect.
   * Example: skip "create_customer" when TSBSB already exists in the DB,
   * inject { customerId: 'existing-uuid' } as the node's outputs.
   */
  skipNodes?: SkipNodeSpec[];
  /**
   * Phase 6: Maximum number of nodes that may execute simultaneously within a
   * parallel level. Default: unlimited (all nodes in a level run concurrently).
   * Set to 1 to force sequential execution even for independent nodes.
   */
  concurrency?: number;
}

// ── Mock node executor type ───────────────────────────────────────────────────

export type MockNodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
