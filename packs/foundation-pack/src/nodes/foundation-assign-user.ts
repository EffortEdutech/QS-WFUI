/**
 * foundation.assign_user
 *
 * Assign a user to a resource within a workflow.
 * Writes the assignee into the resource's data field:
 *   data.assignee     — userId
 *   data.assigneeRole — role string (optional)
 *
 * Inputs (config or dynamic):
 *   resourceId    — lados_resources.id (required)
 *   userId        — user to assign (required)
 *   assigneeRole  — label for the assignment (e.g. 'driver', 'reviewer') — optional
 *
 * Outputs:
 *   assigned    — boolean
 *   resourceId  — the resource ID that was updated
 *   userId      — the user that was assigned
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Service interface ─────────────────────────────────────────────────────────

/** Minimal slice of IResourceService needed for user assignment */
export interface IAssignableResourceService {
  updateResource(
    id: string,
    orgId: string,
    updates: {
      data?: Record<string, unknown>;
    },
    updatedBy: string,
  ): Promise<{ id: string }>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realAssignUser(
  ctx: NodeContext,
  resourceService?: IAssignableResourceService,
): Promise<NodeExecuteResult> {
  if (!resourceService) {
    return {
      status: 'failure',
      outputs: { assigned: false, resourceId: null, userId: null },
      error: { code: 'NO_SERVICE', message: 'ResourceService not injected' },
    };
  }

  const resourceId   = (ctx.inputs['resourceId']   ?? ctx.config['resourceId'])   as string | undefined;
  const userId       = (ctx.inputs['userId']        ?? ctx.config['userId'])        as string | undefined;
  const assigneeRole = (ctx.inputs['assigneeRole']  ?? ctx.config['assigneeRole']) as string | undefined;

  if (!resourceId) {
    return {
      status: 'failure',
      outputs: { assigned: false, resourceId: null, userId: null },
      error: { code: 'MISSING_INPUT', message: 'resourceId is required' },
    };
  }

  if (!userId) {
    return {
      status: 'failure',
      outputs: { assigned: false, resourceId: null, userId: null },
      error: { code: 'MISSING_INPUT', message: 'userId is required' },
    };
  }

  const orgId    = (ctx.organizationId ?? ctx.config['orgId']) as string | undefined;
  const actorId  = ctx.userId ?? 'system';

  if (!orgId) {
    return {
      status: 'failure',
      outputs: { assigned: false, resourceId, userId },
      error: { code: 'MISSING_CONTEXT', message: 'orgId not available in execution context' },
    };
  }

  ctx.logger.info(`foundation.assign_user → resource:${resourceId} user:${userId} role:${assigneeRole ?? 'unspecified'}`);

  try {
    const dataUpdate: Record<string, unknown> = {
      assignee:     userId,
      assignedAt:   new Date().toISOString(),
      assignedBy:   actorId,
    };
    if (assigneeRole) dataUpdate['assigneeRole'] = assigneeRole;

    await resourceService.updateResource(resourceId, orgId, { data: dataUpdate }, actorId);

    return {
      status: 'success',
      outputs: {
        assigned:    true,
        resourceId,
        userId,
        assigneeRole: assigneeRole ?? null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`foundation.assign_user failed: ${msg}`);
    return {
      status: 'failure',
      outputs: { assigned: false, resourceId, userId },
      error: { code: 'ASSIGN_FAILED', message: msg },
    };
  }
}
