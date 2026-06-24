/**
 * Queue constants — Phase 12: Async Execution Queue
 */

import type { SkipNodeSpec } from '@lados/execution-engine';

export const EXECUTION_QUEUE_NAME = 'lados-execution';

export const EXECUTION_JOB_TYPE = {
  TRIGGER:  'trigger',
  RESUME:   'resume',
} as const;

export type ExecutionJobType = typeof EXECUTION_JOB_TYPE[keyof typeof EXECUTION_JOB_TYPE];

/** Job payload stored in BullMQ */
export interface ExecutionJobPayload {
  type:         ExecutionJobType;
  runId:        string;
  workflowId:   string;
  projectId:    string;
  orgId:        string;
  userId:       string;
  /** Nodes to skip — merged from dto.skipNodes + org-level pack_node_overrides (converted to instance IDs) */
  skipNodes?:   SkipNodeSpec[];
  /** Only set on RESUME jobs */
  resumeFromCheckpoint?: {
    pausedAtNodeId:    string;
    checkpointOutputs: Record<string, Record<string, unknown>>;
    approvalResult: {
      approved:      boolean;
      rejected:      boolean;
      comments:      string;
      approvalTaskId: string;
      decidedBy:     string;
    };
  };
}

/** SSE event names emitted during a run */
export const RUN_EVENT = {
  NODE_STARTED:  'run.node_started',
  NODE_DONE:     'run.node_done',
  RUN_COMPLETE:  'run.complete',
  RUN_PAUSED:    'run.paused',
  RUN_FAILED:    'run.failed',
} as const;
