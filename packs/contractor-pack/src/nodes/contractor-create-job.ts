/**
 * contractor.create_job
 *
 * Creates a Job resource for a contractor organisation.
 * Optionally links to a Customer resource.
 *
 * Inputs:
 *   title          — job title (required)
 *   customerId     — customer resource ID to link (optional)
 *   description    — job description (optional)
 *   scheduledDate  — ISO 8601 date (optional)
 *   projectId      — project to attach job to (optional)
 *
 * Outputs:
 *   jobId    — created job resource ID
 *   jobState — initial job state ('draft')
 *
 * Uses ctx.organizationId (NOT ctx.orgId).
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { JobData } from '../types';

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Service interface ─────────────────────────────────────────────────────────

export interface IResourceService {
  create(params: {
    orgId:      string;
    type:       string;
    name:       string;
    data?:      Record<string, unknown>;
    projectId?: string;
    parentId?:  string;
    createdBy?: string;
  }): Promise<{ id: string; state: string; type: string; name: string }>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realCreateJob(
  ctx: NodeContext,
  resourceService?: IResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const title         = (inp['title'] as string | undefined)        ?? (ctx.config['title'] as string | undefined);
  const customerId    = (inp['customerId'] as string | undefined)    ?? (ctx.config['customerId'] as string | undefined);
  const description   = (inp['description'] as string | undefined)   ?? (ctx.config['description'] as string | undefined);
  const scheduledDate = (inp['scheduledDate'] as string | undefined) ?? (ctx.config['scheduledDate'] as string | undefined);
  const projectId     = (inp['projectId'] as string | undefined)     ?? (ctx.config['projectId'] as string | undefined);

  if (!title)               return err('contractor.create_job: title is required');
  if (!ctx.organizationId)  return err('contractor.create_job: organizationId missing from context');
  if (!resourceService)     return err('contractor.create_job: resourceService not injected');

  const data: JobData = {
    ...(customerId    ? { customerId }    : {}),
    ...(description   ? { description }   : {}),
    ...(scheduledDate ? { scheduledDate } : {}),
  };

  const job = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'job',
    name:      title,
    data:      { ...data } as Record<string, unknown>,
    ...(projectId  ? { projectId }  : {}),
    ...(customerId ? { parentId: customerId } : {}),
    createdBy: ctx.userId,
  });

  return {
    status: 'success',
    outputs: {
      jobId:    job.id,
      jobState: job.state,
    },
  };
}
