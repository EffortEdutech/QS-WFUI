/**
 * @qsos/execution-engine
 *
 * Workflow execution engine for QS-OS.
 * Sprint 6 (S6-002) — sequential mock execution.
 *
 * @example
 *   import { runWorkflow } from '@qsos/execution-engine';
 *   const result = await runWorkflow({ workflowId, projectId, ... });
 */

export const EXECUTION_ENGINE_VERSION = '0.1.0' as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
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
