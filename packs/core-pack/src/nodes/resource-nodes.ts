/**
 * Resource nodes — Phase 3
 *
 * Five workflow nodes that operate on lados_resources:
 *   resource.create     — create a new resource
 *   resource.read       — fetch a resource by id
 *   resource.update     — patch name / data on a resource
 *   resource.transition — advance the resource through its state machine
 *   resource.list       — query resources by type / state / project
 *
 * IResourceService is a minimal interface satisfied by NestJS ResourceService
 * via structural (duck) typing — no NestJS imports in this pack.
 *
 * AI guardrail: resource.transition may NOT be called from AI-generated
 * output without prior human approval. The calling workflow is responsible
 * for placing a core.human_approval node before any AI-driven transition.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── IResourceService ──────────────────────────────────────────────────────────

/** Phase 5: expanded with Contractor Edition types (trip, invoice, payment) */
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

  updateResource(
    id: string,
    orgId: string,
    updates: {
      name?: string;
      data?: Record<string, unknown>;
      projectId?: string | null;
      parentId?: string | null;
    },
    actorId: string,
  ): Promise<IResource>;

  transitionState(
    id: string,
    orgId: string,
    toState: string,
    actorId: string,
  ): Promise<IResource>;

  listResources(
    orgId: string,
    filters: {
      type?: ResourceType;
      state?: string;
      projectId?: string;
      parentId?: string;
      limit?: number;
    },
  ): Promise<IResource[]>;
}

// ── resource.create ───────────────────────────────────────────────────────────

export async function realResourceCreate(
  ctx: NodeContext,
  resourceService: IResourceService,
): Promise<NodeExecuteResult> {
  const name      = ctx.config['name'] as string | undefined;
  const type      = (ctx.config['type'] as ResourceType | undefined) ?? 'custom';
  const projectId = ctx.config['project_id'] as string | undefined;
  const parentId  = ctx.config['parent_id'] as string | undefined;
  const data      = (ctx.config['data'] as Record<string, unknown> | undefined) ?? {};

  if (!name) {
    return { status: 'failure', outputs: {}, error: { code: 'MISSING_NAME', message: 'resource.create requires config.name' } };
  }

  ctx.logger.info(`resource.create [${type}] "${name}"`);

  try {
    const resource = await resourceService.createResource({
      orgId:     ctx.organizationId,
      projectId: projectId ?? ctx.projectId,
      type,
      name,
      data,
      parentId,
      createdBy: ctx.userId,
    });

    return {
      status:  'success',
      outputs: { resource, resourceId: resource.id, state: resource.state },
      summary: `Created ${type} resource "${name}" (${resource.id}) → ${resource.state}`,
    };
  } catch (err) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'CREATE_FAILED', message: (err as Error).message },
    };
  }
}

// ── resource.read ─────────────────────────────────────────────────────────────

export async function realResourceRead(
  ctx: NodeContext,
  resourceService: IResourceService,
): Promise<NodeExecuteResult> {
  const resourceId =
    (ctx.config['resource_id'] as string | undefined) ??
    (ctx.inputs['resourceId'] as string | undefined);

  if (!resourceId) {
    return { status: 'failure', outputs: {}, error: { code: 'MISSING_ID', message: 'resource.read requires config.resource_id or input resourceId' } };
  }

  ctx.logger.info(`resource.read ${resourceId}`);

  try {
    const resource = await resourceService.getResource(resourceId, ctx.organizationId);
    return {
      status:  'success',
      outputs: { resource, resourceId: resource.id, state: resource.state },
      summary: `Read resource ${resourceId} → state: ${resource.state}`,
    };
  } catch (err) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'READ_FAILED', message: (err as Error).message },
    };
  }
}

// ── resource.update ───────────────────────────────────────────────────────────

export async function realResourceUpdate(
  ctx: NodeContext,
  resourceService: IResourceService,
): Promise<NodeExecuteResult> {
  const resourceId =
    (ctx.config['resource_id'] as string | undefined) ??
    (ctx.inputs['resourceId'] as string | undefined);

  if (!resourceId) {
    return { status: 'failure', outputs: {}, error: { code: 'MISSING_ID', message: 'resource.update requires resource_id' } };
  }

  const updates = {
    name:      ctx.config['name']       as string | undefined,
    data:      ctx.config['data']       as Record<string, unknown> | undefined,
    projectId: ctx.config['project_id'] as string | null | undefined,
    parentId:  ctx.config['parent_id']  as string | null | undefined,
  };

  ctx.logger.info(`resource.update ${resourceId}`);

  try {
    const resource = await resourceService.updateResource(
      resourceId, ctx.organizationId, updates, ctx.userId,
    );
    return {
      status:  'success',
      outputs: { resource, resourceId: resource.id },
      summary: `Updated resource ${resourceId}`,
    };
  } catch (err) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'UPDATE_FAILED', message: (err as Error).message },
    };
  }
}

// ── resource.transition ───────────────────────────────────────────────────────

export async function realResourceTransition(
  ctx: NodeContext,
  resourceService: IResourceService,
): Promise<NodeExecuteResult> {
  const resourceId =
    (ctx.config['resource_id'] as string | undefined) ??
    (ctx.inputs['resourceId'] as string | undefined);
  const toState = ctx.config['to_state'] as string | undefined;

  if (!resourceId || !toState) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'MISSING_PARAMS', message: 'resource.transition requires resource_id and to_state' },
    };
  }

  ctx.logger.info(`resource.transition ${resourceId} → ${toState}`);

  try {
    const resource = await resourceService.transitionState(
      resourceId, ctx.organizationId, toState, ctx.userId,
    );
    return {
      status:  'success',
      outputs: { resource, resourceId: resource.id, fromState: resource.state, toState },
      summary: `Resource ${resourceId} transitioned → ${toState}`,
    };
  } catch (err) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'TRANSITION_FAILED', message: (err as Error).message },
    };
  }
}

// ── resource.list ─────────────────────────────────────────────────────────────

export async function realResourceList(
  ctx: NodeContext,
  resourceService: IResourceService,
): Promise<NodeExecuteResult> {
  const type      = ctx.config['type']       as ResourceType | undefined;
  const state     = ctx.config['state']      as string | undefined;
  const projectId = ctx.config['project_id'] as string | undefined;
  const parentId  = ctx.config['parent_id']  as string | undefined;
  const limit     = ctx.config['limit']      as number | undefined;

  ctx.logger.info(`resource.list type=${type ?? 'any'} state=${state ?? 'any'}`);

  try {
    const resources = await resourceService.listResources(ctx.organizationId, {
      type,
      state,
      projectId: projectId ?? (ctx.projectId || undefined),
      parentId,
      limit,
    });

    return {
      status:  'success',
      outputs: { resources, count: resources.length },
      summary: `Listed ${resources.length} resource(s)`,
    };
  } catch (err) {
    return {
      status: 'failure',
      outputs: {},
      error: { code: 'LIST_FAILED', message: (err as Error).message },
    };
  }
}
