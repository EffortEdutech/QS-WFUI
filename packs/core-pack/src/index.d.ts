import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Re-exported service interfaces ────────────────────────────────────────────
export { type INotificationService }  from './nodes/core-human-approval';
export { type IResourceService, type IResource, type ResourceType } from './nodes/resource-nodes';
export { type IEventBusService }      from './nodes/event-nodes';
export { type IStateEngineService }   from './nodes/state-change-node';
export { type IArtifactWriteService } from './nodes/artifact-write';
export { type IArtifactReadService }  from './nodes/artifact-read';

export declare const PACK_ID: "core-pack";
export declare const PACK_VERSION: "0.6.0";
export declare const manifest: PackManifest;

export interface CorePackServices {
    notificationService?: import('./nodes/core-human-approval').INotificationService;
    resourceService?:     import('./nodes/resource-nodes').IResourceService;
    eventBusService?:     import('./nodes/event-nodes').IEventBusService;
    stateEngineService?:  import('./nodes/state-change-node').IStateEngineService;
    artifactService?:     import('./nodes/artifact-write').IArtifactWriteService
                        & import('./nodes/artifact-read').IArtifactReadService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

export declare function resolveNode(services?: CorePackServices): (nodeType: string) => NodeExecutor | null;
//# sourceMappingURL=index.d.ts.map
