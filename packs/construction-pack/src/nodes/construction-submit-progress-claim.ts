/**
 * construction.submit_progress_claim
 *
 * Creates a ProgressClaim resource linked to a ConstructionProject and
 * immediately transitions it from 'draft' to 'submitted'.
 *
 * Inputs:
 *   projectResourceId  — construction_project resource ID (required)
 *   claimNo            — claim reference number e.g. "PC-001" (optional)
 *   claimPeriodStart   — ISO 8601 start of claim period (optional)
 *   claimPeriodEnd     — ISO 8601 end of claim period (optional)
 *   claimAmount        — total claimed amount in MYR (optional)
 *   currency           — default 'MYR' (optional)
 *   claimItems         — array of ProgressClaimItem (optional)
 *   projectId          — Lados project to attach to (optional)
 *
 * Outputs:
 *   claimId     — created progress_claim resource ID
 *   claimState  — state after submission ('submitted')
 *   claimNo     — claim reference number
 *   claimAmount — total claimed amount
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type {
  IConstructionResourceService,
  ProgressClaimData,
  ProgressClaimItem,
} from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realSubmitProgressClaim(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const claimNo           = (inp['claimNo']           ?? cfg['claimNo'])           as string | undefined;
  const claimPeriodStart  = (inp['claimPeriodStart']  ?? cfg['claimPeriodStart'])  as string | undefined;
  const claimPeriodEnd    = (inp['claimPeriodEnd']    ?? cfg['claimPeriodEnd'])    as string | undefined;
  const claimAmount       = (inp['claimAmount']       ?? cfg['claimAmount'])       as number | undefined;
  const currency          = (inp['currency']          ?? cfg['currency'])          as string | undefined ?? 'MYR';
  const claimItems        = (inp['claimItems']        ?? cfg['claimItems'])        as ProgressClaimItem[] | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('construction.submit_progress_claim: projectResourceId is required');
  if (!ctx.organizationId) return err('construction.submit_progress_claim: organizationId missing from context');
  if (!resourceService)   return err('construction.submit_progress_claim: resourceService not injected');

  const now  = new Date().toISOString();
  const label = claimNo ?? `PC-${Date.now()}`;

  const data: ProgressClaimData = {
    projectResourceId,
    ...(claimNo          ? { claimNo }          : {}),
    ...(claimPeriodStart ? { claimPeriodStart }  : {}),
    ...(claimPeriodEnd   ? { claimPeriodEnd }    : {}),
    ...(claimAmount      ? { claimAmount }       : {}),
    currency,
    ...(claimItems       ? { claimItems }        : {}),
    submittedBy: ctx.userId,
    submittedAt: now,
  };

  // Create resource in 'draft' state
  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'progress_claim',
    name:      label,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  // Transition draft → submitted
  const submitted = await resourceService.transitionState(
    resource.id, ctx.organizationId, 'submitted', ctx.userId,
  );

  ctx.logger.info(
    `[construction.submit_progress_claim] Claim "${label}" submitted ` +
    `(id=${submitted.id}, state=${submitted.state}, amount=${claimAmount ?? 'N/A'})`,
  );

  return {
    status: 'success',
    outputs: {
      claimId:     submitted.id,
      claimState:  submitted.state,
      claimNo:     label,
      claimAmount: claimAmount ?? null,
    },
  };
}
