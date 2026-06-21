import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IStateEngineService {
    executeTransition(params: {
        resourceId: string;
        orgId: string;
        fromState: string;
        resourceType: string;
        toState: string;
        actorId: string;
        actorRole?: string;
        executionId?: string;
        workflowId?: string;
        projectId?: string;
    }): Promise<
        | { status: 'completed'; newState: string }
        | { status: 'approval_required'; approvalTaskId: string; pendingToState: string }
        | { status: 'blocked'; reason: string }
    >;
}

export declare function realStateChange(ctx: NodeContext, stateEngine: IStateEngineService): Promise<NodeExecuteResult>;
//# sourceMappingURL=state-change-node.d.ts.map
