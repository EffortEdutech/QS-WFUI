/**
 * construction.certify_progress_claim
 *
 * Issues a Certificate of Payment for an assessed progress claim.
 * Transitions the claim from 'under_assessment' → 'certified'.
 *
 * ⚠️  AI GUARDRAIL (NON-NEGOTIABLE):
 *   This node MUST appear DOWNSTREAM of foundation.request_approval in any
 *   workflow. Construction.certify_progress_claim must NOT be called by
 *   AI-generated workflow paths without prior explicit human approval.
 *   Certifying a progress claim is a financial commitment — it triggers
 *   payment obligations. AI cannot issue certificates.
 *
 * Inputs:
 *   claimId              — progress_claim resource ID (required)
 *   certifiedAmount      — final certified amount in MYR (required)
 *   certificateNo        — certificate reference number e.g. "IPC-001" (optional)
 *   certificationComments — any comments / conditions (optional)
 *
 * Outputs:
 *   claimId          — same claim ID (pass-through)
 *   certifiedAmount  — certified amount (MYR)
 *   certificateNo    — certificate reference
 *   claimState       — state after certification ('certified')
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realCertifyProgressClaim(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const claimId               = (inp['claimId']               ?? cfg['claimId'])               as string | undefined;
  const certifiedAmount       = (inp['certifiedAmount']        ?? cfg['certifiedAmount'])        as number | undefined;
  const certificateNo         = (inp['certificateNo']          ?? cfg['certificateNo'])          as string | undefined;
  const certificationComments = (inp['certificationComments']  ?? cfg['certificationComments'])  as string | undefined;

  if (!claimId)              return err('construction.certify_progress_claim: claimId is required');
  if (certifiedAmount === undefined) return err('construction.certify_progress_claim: certifiedAmount is required');
  if (!ctx.organizationId)  return err('construction.certify_progress_claim: organizationId missing from context');
  if (!resourceService)     return err('construction.certify_progress_claim: resourceService not injected');

  // Fetch current claim
  const claim = await resourceService.findById(claimId, ctx.organizationId);
  if (!claim) {
    return {
      status: 'failure', outputs: {},
      error: { code: 'NOT_FOUND', message: `Progress claim ${claimId} not found` },
    };
  }

  if (!['submitted', 'under_assessment'].includes(claim.state)) {
    return {
      status: 'failure', outputs: {},
      error: {
        code: 'INVALID_STATE',
        message: `Cannot certify claim in state "${claim.state}". Expected submitted or under_assessment.`,
      },
    };
  }

  const now     = new Date().toISOString();
  const certNo  = certificateNo ?? `IPC-${Date.now()}`;

  // Patch certificate details
  const updatedData: Record<string, unknown> = {
    ...claim.data,
    certifiedAmount,
    certificateNo:          certNo,
    certifiedBy:            ctx.userId,
    certifiedAt:            now,
    ...(certificationComments ? { certificationComments } : {}),
  };

  await resourceService.updateResource(
    claimId, ctx.organizationId,
    { data: updatedData },
    ctx.userId,
  );

  // Ensure we're at under_assessment before certifying
  let stateToTransitionFrom = claim.state;
  if (stateToTransitionFrom === 'submitted') {
    await resourceService.transitionState(claimId, ctx.organizationId, 'under_assessment', ctx.userId);
    stateToTransitionFrom = 'under_assessment';
  }

  const certified = await resourceService.transitionState(
    claimId, ctx.organizationId, 'certified', ctx.userId,
  );

  ctx.logger.info(
    `[construction.certify_progress_claim] Certificate ${certNo} issued for claim ${claimId} — ` +
    `MYR ${certifiedAmount} (state=${certified.state})`,
  );

  return {
    status: 'success',
    outputs: {
      claimId,
      certifiedAmount,
      certificateNo: certNo,
      claimState:    certified.state,
    },
  };
}
