/**
 * construction.assess_progress_claim
 *
 * QS assessment of a submitted progress claim. Updates the claim resource
 * with assessment findings and transitions it to 'under_assessment'.
 *
 * This node is the QS intermediate step — it records the QS's assessed
 * amount and findings but does NOT issue a Certificate of Payment.
 * Use construction.certify_progress_claim (which requires prior human
 * approval) for final certification.
 *
 * Inputs:
 *   claimId         — progress_claim resource ID (required)
 *   assessedAmount  — QS-certified amount in MYR (required)
 *   assessmentNotes — notes / justification for the assessed amount (optional)
 *   certifiedItems  — array of assessed ProgressClaimItems (optional)
 *
 * Outputs:
 *   claimId        — same claim ID (pass-through)
 *   assessedAmount — QS-assessed amount
 *   claimState     — updated state ('under_assessment')
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type {
  IConstructionResourceService,
  ProgressClaimItem,
} from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realAssessProgressClaim(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const claimId        = (inp['claimId']        ?? cfg['claimId'])        as string | undefined;
  const assessedAmount = (inp['assessedAmount']  ?? cfg['assessedAmount']) as number | undefined;
  const assessmentNotes = (inp['assessmentNotes'] ?? cfg['assessmentNotes']) as string | undefined;
  const certifiedItems = (inp['certifiedItems']  ?? cfg['certifiedItems']) as ProgressClaimItem[] | undefined;

  if (!claimId)         return err('construction.assess_progress_claim: claimId is required');
  if (assessedAmount === undefined) return err('construction.assess_progress_claim: assessedAmount is required');
  if (!ctx.organizationId) return err('construction.assess_progress_claim: organizationId missing from context');
  if (!resourceService) return err('construction.assess_progress_claim: resourceService not injected');

  // Fetch current claim
  const claim = await resourceService.findById(claimId, ctx.organizationId);
  if (!claim) {
    return { status: 'failure', outputs: {}, error: { code: 'NOT_FOUND', message: `Progress claim ${claimId} not found` } };
  }

  const now = new Date().toISOString();

  // Merge assessment data into existing data
  const updatedData: Record<string, unknown> = {
    ...claim.data,
    assessedAmount,
    assessedBy:   ctx.userId,
    assessedAt:   now,
    ...(assessmentNotes ? { assessmentNotes } : {}),
    ...(certifiedItems  ? { claimItems: certifiedItems } : {}),
  };

  await resourceService.updateResource(
    claimId, ctx.organizationId,
    { data: updatedData },
    ctx.userId,
  );

  // Transition submitted → under_assessment (idempotent if already there)
  let finalState = claim.state;
  if (claim.state === 'submitted') {
    const updated = await resourceService.transitionState(
      claimId, ctx.organizationId, 'under_assessment', ctx.userId,
    );
    finalState = updated.state;
  }

  ctx.logger.info(
    `[construction.assess_progress_claim] Claim ${claimId} assessed: ` +
    `MYR ${assessedAmount} (state=${finalState})`,
  );

  return {
    status: 'success',
    outputs: {
      claimId,
      assessedAmount,
      claimState: finalState,
    },
  };
}
