import type { WorkflowId, NodeInstanceId, NodeTypeId } from './ids';
import type { WorkflowStatus } from './status';
export interface QSWorkflowDefinition {
    schemaVersion: string;
    workflow: WorkflowInfo;
    nodes: WorkflowNodeInstance[];
    connections: WorkflowConnection[];
    variables?: WorkflowVariable[];
    metadata?: WorkflowMetadata;
}
export interface WorkflowInfo {
    id: WorkflowId;
    name: string;
    description?: string;
    version: string;
    status: WorkflowStatus;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}
export type SkillMode = 'active' | 'muted' | 'bypassed';
export interface WorkflowNodeInstance {
    id: NodeInstanceId;
    type: NodeTypeId;
    label?: string;
    position: {
        x: number;
        y: number;
    };
    config?: Record<string, unknown>;
    mode?: SkillMode;
}
export interface WorkflowConnection {
    id: string;
    sourceNodeId: NodeInstanceId;
    sourcePortId: string;
    targetNodeId: NodeInstanceId;
    targetPortId: string;
}
export interface WorkflowVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    defaultValue?: unknown;
    description?: string;
}
export interface WorkflowMetadata {
    packId?: string;
    author?: string;
    [key: string]: unknown;
}
export interface WorkflowSummary {
    id: WorkflowId;
    name: string;
    description?: string;
    version: string;
    status: WorkflowStatus;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    nodeCount?: number;
}
//# sourceMappingURL=workflow.d.ts.map