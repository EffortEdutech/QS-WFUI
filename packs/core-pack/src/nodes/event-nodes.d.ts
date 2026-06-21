import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IEventBusService {
    publish(params: {
        orgId: string;
        type: string;
        sourceType?: string;
        sourceId?: string;
        actorId?: string;
        payload?: Record<string, unknown>;
    }): Promise<{ id: string } | null>;
}

export declare function realEventPublish(ctx: NodeContext, eventBus: IEventBusService): Promise<NodeExecuteResult>;
//# sourceMappingURL=event-nodes.d.ts.map
