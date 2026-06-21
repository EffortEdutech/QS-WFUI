/**
 * @lados/execution-engine
 *
 * Workflow execution engine for QS-OS.
 * Sprint 6 (S6-002) — sequential mock execution.
 * Sprint 7 (S7-005) — real node resolver support.
 *
 * @example
 *   import { runWorkflow } from '@lados/execution-engine';
 *   const result = await runWorkflow({ workflowId, projectId, ... });
 */

export const EXECUTION_ENGINE_VERSION = '0.1.0' as const;

// ── Types ─────────────────────────────────────────────────────────────────────
// Re-export node-sdk types so callers don't need a direct node-sdk dep
export type {
  // From @lados/node-sdk (re-exported via types.ts)
  NodeContext,
  NodeExecuteResult,
  NodeLogger,
  // Engine-internal types
  RunStatus,
  NodeRunStatus,
  ExecutionStep,
  ExecutionPlan,
  NodeLogEntry,
  ExecutionResult,
  RunnerOptions,
  MockNodeExecutor,
} from './types';

// ── Graph planner ─────────────────────────────────────────────────────────────
export { planWorkflow } from './graph-planner';

// ── Mock registry ─────────────────────────────────────────────────────────────
export { getMockExecutor, hasMockFor } from './mock-registry';

// ── Runner ────────────────────────────────────────────────────────────────────
export { WorkflowRunner, runWorkflow } from './runner';
