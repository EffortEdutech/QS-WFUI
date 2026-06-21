import type { QSWorkflowDefinition } from '@lados/shared-types';
import type { NodeContext, NodeExecuteResult, NodeLogger } from '@lados/node-sdk';
export type { NodeContext, NodeExecuteResult, NodeLogger };
export type RunStatus = 'created' | 'queued' | 'validating' | 'planning' | 'running' | 'waiting' | 'paused' | 'retrying' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
export type NodeRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';
export interface ExecutionStep {
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    config: Record<string, unknown>;
    dependsOn: string[];
}
export interface ExecutionPlan {
    steps: ExecutionStep[];
    cycles: string[][];
}
export interface NodeLogEntry {
    nodeId: string;
    nodeType: string;
    nodeName: string;
    status: NodeRunStatus;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    messages: string[];
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
}
export interface ExecutionResult {
    status: RunStatus;
    outputs: Record<string, unknown>;
    logs: NodeLogEntry[];
    error?: {
        code: string;
        message: string;
    };
    startedAt: string;
    completedAt: string;
    durationMs: number;
    pausedAtNodeId?: string;
    checkpointOutputs?: Record<string, Record<string, unknown>>;
    pendingApprovalTaskId?: string;
}
export interface ResumeCheckpoint {
    pausedAtNodeId: string;
    checkpointOutputs: Record<string, Record<string, unknown>>;
    approvalResult: {
        approved: boolean;
        rejected: boolean;
        comments: string;
        approvalTaskId: string;
        decidedBy: string;
    };
}
export interface RunnerOptions {
    executionId?: string;
    workflowId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    definition: QSWorkflowDefinition;
    inputs?: Record<string, unknown>;
    variables?: Record<string, unknown>;
    nodeResolver?: (nodeType: string) => ((ctx: NodeContext) => Promise<NodeExecuteResult>) | null;
    resumeFromCheckpoint?: ResumeCheckpoint;
}
export type MockNodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
//# sourceMappingURL=types.d.ts.map