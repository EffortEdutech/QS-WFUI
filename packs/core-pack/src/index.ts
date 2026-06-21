/**
 * @lados/core-pack
 *
 * Core workflow control nodes — Logger, Cron Trigger, Human Approval,
 * Condition, Artifact read/write, Resource Engine nodes, Event Bus, State Engine.
 *
 * Phase 2: nodes migrated from apps/api/src/execution/real-nodes/
 * Phase 3: resource.create/read/update/transition/list added
 * Phase 4: event.publish added
 * Phase 9 Correction: artifact.write + artifact.read (service-injected, lados_artifacts table)
 *                     project.save_artifact + project.read_artifact kept for legacy compat
 */
import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realHumanApproval }    from './nodes/core-human-approval';
import { realLogger }           from './nodes/core-logger';
import { realCronTrigger }      from './nodes/core-cron-trigger';
import { realCondition }        from './nodes/workflow-condition';
import { realSaveArtifact }     from './nodes/project-save-artifact';   // legacy
import { realReadArtifact }     from './nodes/project-read-artifact';   // legacy
import { realArtifactWrite }    from './nodes/artifact-write';
import { realArtifactRead }     from './nodes/artifact-read';
import {
  realResourceCreate,
  realResourceRead,
  realResourceUpdate,
  realResourceTransition,
  realResourceList,
} from './nodes/resource-nodes';
import { realEventPublish }  from './nodes/event-nodes';
import { realStateChange }   from './nodes/state-change-node';

export { type INotificationService }  from './nodes/core-human-approval';
export { type IResourceService, type IResource, type ResourceType } from './nodes/resource-nodes';
export { type IEventBusService }      from './nodes/event-nodes';
export { type IStateEngineService }   from './nodes/state-change-node';
export { type IArtifactWriteService } from './nodes/artifact-write';
export { type IArtifactReadService }  from './nodes/artifact-read';

export const PACK_ID      = 'core-pack' as const;
export const PACK_VERSION = '0.6.0' as const;

export const manifest: PackManifest = {
  id: PACK_ID,
  version: PACK_VERSION,
  displayName: 'Core Pack',
  description: 'Fundamental workflow control nodes — Logger, CronTrigger, HumanApproval, Condition, Artifact store, Resource Engine, Event Bus, State Engine',
  author: 'Lados Platform',
  nodes: [
    'core.logger',
    'core.cron_trigger',
    'core.human_approval',
    'workflow.condition',
    // Canonical artifact nodes (Phase 9 Correction — lados_artifacts table)
    'artifact.write',
    'artifact.read',
    // Legacy artifact nodes — kept for backward compat with old workflows
    'project.save_artifact',
    'project.read_artifact',
    // Resource Engine
    'resource.create',
    'resource.read',
    'resource.update',
    'resource.transition',
    'resource.list',
    // Event Bus
    'event.publish',
    // State Engine
    'state.change',
  ],
};

export interface CorePackServices {
  notificationService?: import('./nodes/core-human-approval').INotificationService;
  resourceService?:     import('./nodes/resource-nodes').IResourceService;
  eventBusService?:     import('./nodes/event-nodes').IEventBusService;
  stateEngineService?:  import('./nodes/state-change-node').IStateEngineService;
  artifactService?:     import('./nodes/artifact-write').IArtifactWriteService
                      & import('./nodes/artifact-read').IArtifactReadService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const noService = (code: string, msg: string): NodeExecuteResult =>
  ({ status: 'failure', outputs: {}, error: { code, message: msg } });

/**
 * Returns the real executor for a core-pack node type, or null if unknown.
 */
export function resolveNode(
  services: CorePackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const {
    notificationService, resourceService,
    eventBusService, stateEngineService, artifactService,
  } = services;

  const nodes: Record<string, NodeExecutor> = {
    // ── Control flow ─────────────────────────────────────────────────────────
    'core.human_approval':   (ctx) => realHumanApproval(ctx, notificationService),
    'core.logger':           (ctx) => realLogger(ctx),
    'core.cron_trigger':     (ctx) => realCronTrigger(ctx),
    'workflow.condition':    (ctx) => realCondition(ctx),

    // ── Artifacts — canonical (Phase 9 Correction) ────────────────────────
    'artifact.write':        (ctx) => artifactService
      ? realArtifactWrite(ctx, artifactService)
      : Promise.resolve(noService('NO_SERVICE', 'ArtifactService not injected')),
    'artifact.read':         (ctx) => artifactService
      ? realArtifactRead(ctx, artifactService)
      : Promise.resolve(noService('NO_SERVICE', 'ArtifactService not injected')),

    // ── Artifacts — legacy (project.save/read_artifact) ───────────────────
    'project.save_artifact': (ctx) => realSaveArtifact(ctx),
    'project.read_artifact': (ctx) => realReadArtifact(ctx),

    // ── Resource Engine ───────────────────────────────────────────────────
    'resource.create':       (ctx) => resourceService
      ? realResourceCreate(ctx, resourceService)
      : Promise.resolve(noService('NO_SERVICE', 'ResourceService not injected')),
    'resource.read':         (ctx) => resourceService
      ? realResourceRead(ctx, resourceService)
      : Promise.resolve(noService('NO_SERVICE', 'ResourceService not injected')),
    'resource.update':       (ctx) => resourceService
      ? realResourceUpdate(ctx, resourceService)
      : Promise.resolve(noService('NO_SERVICE', 'ResourceService not injected')),
    'resource.transition':   (ctx) => resourceService
      ? realResourceTransition(ctx, resourceService)
      : Promise.resolve(noService('NO_SERVICE', 'ResourceService not injected')),
    'resource.list':         (ctx) => resourceService
      ? realResourceList(ctx, resourceService)
      : Promise.resolve(noService('NO_SERVICE', 'ResourceService not injected')),

    // ── Event Bus ─────────────────────────────────────────────────────────
    'event.publish':         (ctx) => eventBusService
      ? realEventPublish(ctx, eventBusService)
      : Promise.resolve(noService('NO_SERVICE', 'EventBusService not injected')),

    // ── State Engine ──────────────────────────────────────────────────────
    'state.change':          (ctx) => stateEngineService
      ? realStateChange(ctx, stateEngineService)
      : Promise.resolve(noService('NO_SERVICE', 'StateEngineService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
