import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export type ResourceType =
    | 'job' | 'fleet' | 'worker' | 'material' | 'site'
    | 'trip' | 'invoice' | 'payment'
    | 'custom';

export interface IResource {
    id: string;
    org_id: string;
    project_id: string | null;
    type: ResourceType;
    name: string;
    state: string;
    data: Record<string, unknown>;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface IResourceService {
    createResource(params: {
        orgId: string;
        projectId?: string;
        type: ResourceType;
        name: string;
        data?: Record<string, unknown>;
        parentId?: string;
        createdBy: string;
    }): Promise<IResource>;
    getResource(id: string, orgId: string): Promise<IResource>;
    updateResource(id: string, orgId: string, updates: {
        name?: string;
        data?: Record<string, unknown>;
        projectId?: string | null;
        parentId?: string | null;
    }, actorId: string): Promise<IResource>;
    transitionState(id: string, orgId: string, toState: string, actorId: string): Promise<IResource>;
    listResources(orgId: string, filters: {
        type?: ResourceType;
        state?: string;
        projectId?: string;
        parentId?: string;
        limit?: number;
    }): Promise<IResource[]>;
}

export declare function realResourceCreate(ctx: NodeContext, resourceService: IResourceService): Promise<NodeExecuteResult>;
export declare function realResourceRead(ctx: NodeContext, resourceService: IResourceService): Promise<NodeExecuteResult>;
export declare function realResourceUpdate(ctx: NodeContext, resourceService: IResourceService): Promise<NodeExecuteResult>;
export declare function realResourceTransition(ctx: NodeContext, resourceService: IResourceService): Promise<NodeExecuteResult>;
export declare function realResourceList(ctx: NodeContext, resourceService: IResourceService): Promise<NodeExecuteResult>;
//# sourceMappingURL=resource-nodes.d.ts.map
