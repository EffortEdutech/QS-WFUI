/**
 * finance.claim_retention_release
 *
 * Creates a RetentionRelease resource and sets it to 'claimed' state.
 * Used to formally claim the release of retention monies held under
 * a construction contract — either at Practical Completion (half release)
 * or at expiry of the Defects Liability Period (final release).
 *
 * Context: PAM/JKR contracts typically hold 5-10% retention of each IPC.
 * Half is released at CPC; the remainder at end of DLP.
 *
 * Inputs:
 *   projectResourceId           — parent construction_project resource ID (required)
 *   retentionAmount             — amount being claimed MYR (required)
 *   retentionType               — 'half_release' | 'final_release' (optional)
 *   claimBasis                  — 'practical_completion' | 'dlp_expiry' | 'other' (optional)
 *   projectCompletionDate       — CPC date ISO 8601 (optional)
 *   defectsLiabilityPeriodEnd   — DLP end date ISO 8601 (optional)
 *   description                 — narrative for the claim (optional)
 *   currency                    — default MYR (optional)
 *   projectId                   — Lados project to attach to (optional)
 *
 * Outputs:
 *   retentionId     — created resource ID
 *   retentionState  — 'claimed'
 *   retentionAmount — amount claimed
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService, RetentionReleaseData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realClaimRetentionRelease(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId         = (inp['projectResourceId']         ?? cfg['projectResourceId'])         as string | undefined;
  const retentionAmount           = (inp['retentionAmount']           ?? cfg['retentionAmount'])           as number | undefined;
  const retentionType             = (inp['retentionType']             ?? cfg['retentionType'])             as string | undefined ?? 'half_release';
  const claimBasis                = (inp['claimBasis']                ?? cfg['claimBasis'])                as string | undefined ?? 'practical_completion';
  const projectCompletionDate     = (inp['projectCompletionDate']     ?? cfg['projectCompletionDate'])     as string | undefined;
  const defectsLiabilityPeriodEnd = (inp['defectsLiabilityPeriodEnd'] ?? cfg['defectsLiabilityPeriodEnd']) as string | undefined;
  const description               = (inp['description']               ?? cfg['description'])               as string | undefined;
  const currency                  = (inp['currency']                  ?? cfg['currency'])                  as string | undefined ?? 'MYR';
  const projectId                 = (inp['projectId']                 ?? cfg['projectId'])                 as string | undefined;

  if (!projectResourceId) return err('finance.claim_retention_release: projectResourceId is required');
  if (retentionAmount === undefined || retentionAmount === null)
    return err('finance.claim_retention_release: retentionAmount is required');
  if (!ctx.organizationId) return err('finance.claim_retention_release: organizationId missing from context');
  if (!resourceService)    return err('finance.claim_retention_release: resourceService not injected');

  const now = new Date().toISOString();
  const data: RetentionReleaseData = {
    projectResourceId,
    retentionAmount,
    retentionType,
    claimBasis,
    currency,
    claimedBy:  ctx.userId,
    claimedAt:  now,
    ...(projectCompletionDate     ? { projectCompletionDate }     : {}),
    ...(defectsLiabilityPeriodEnd ? { defectsLiabilityPeriodEnd } : {}),
    ...(description               ? { description }               : {}),
  };

  const typeLabel = retentionType === 'final_release' ? 'Final Retention Release' : 'Half Retention Release';
  const name = `${typeLabel} — ${retentionAmount.toLocaleString()} ${currency}`;

  // Create in pending, then transition to claimed
  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'retention_release',
    name,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  const claimed = await resourceService.transitionState(
    resource.id,
    ctx.organizationId,
    'claimed',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.claim_retention_release] Retention claim "${name}" created (id=${resource.id}, state=${claimed.state}, amount=${retentionAmount} ${currency})`,
  );

  return {
    status: 'success',
    outputs: {
      retentionId:     resource.id,
      retentionState:  claimed.state,
      retentionAmount,
    },
  };
}
