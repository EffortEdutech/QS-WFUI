/**
 * @qsos/execution-engine — Core types
 * Sprint 6 (S6-002)
 */

import type { QSWorkflowDefinition } from '@qsos/shared-types';
import type { NodeContext, NodeExecuteResult, NodeLogger } from '@qsos/node-sdk';

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
}

export interface ExecutionPlan {
  /** Ordered list of steps (topological sort) */
  steps: ExecutionStep[];
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
}

// ── Runner options ────────────────────────────────────────────────────────────

export interface RunnerOptions {
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  definition: QSWorkflowDefinition;
  inputs?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

// ── Mock node result factory (used by mock registry) ─────────────────────────

export type MockNodeExecutor = (
  nodeType: string,
  ctx: NodeContext,
) => Promise<NodeExecuteResult>;
