/**
 * construction.approve_variation
 *
 * Approves a submitted Variation resource, transitioning it to 'approved'.
 *
 * ⚠️  AI GUARDRAIL (NON-NEGOTIABLE):
 *   This node MUST appear DOWNSTREAM of foundation.request_approval in any
 *   workflow. Approving a variation is a contractual commitment — it alters
 *   the contract sum and/or programme. AI cannot approve contract variations.
 *
 * Inputs:
 *   variationId       — variation resource ID (required)
 *   approvedAmount    — approved cost impact in MYR (optional; defaults to stated costImpact)
 *   timeExtension     — approved calendar days extension (optional)
 *   approvalComments  — comments / conditions attached to approval (optional)
 *
 * Outputs:
 *   variationId       — same variation ID (pass-through)
 *   approvedAmount    — final approved amount
 *   timeExtension     — approved time extension
 *   variationState    — state after approval ('approved')
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realApproveVariation(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const variationId      = (inp['variationId']      ?? cfg['variationId'])      as string | undefined;
  const approvedAmount   = (inp['approvedAmount']   ?? cfg['approvedAmount'])   as number | undefined;
  const timeExtension    = (inp['timeExtension']    ?? cfg['timeExtension'])    as number | undefined;
  const approvalComments = (inp['approvalComments'] ?? cfg['approvalComments']) as string | undefined;

  if (!variationId)       return err('construction.approve_variation: variationId is required');
  if (!ctx.organizationId) return err('construction.approve_variation: organizationId missing from context');
  if (!resourceService)   return err('construction.approve_variation: resourceService not injected');

  const variation = await resourceService.findById(variationId, ctx.organizationId);
  if (!variation) {
    return {
      status: 'failure', outputs: {},
      error: { code: 'NOT_FOUND', message: `Variation ${variationId} not found` },
    };
  }

  if (!['submitted', 'under_review'].includes(variation.state)) {
    return {
      status: 'failure', outputs: {},
      error: {
        code: 'INVALID_STATE',
        message: `Cannot approve variation in state "${variation.state}". Expected submitted or under_review.`,
      },
    };
  }

  const now            = new Date().toISOString();
  const finalAmount    = approvedAmount ?? (variation.data['costImpact'] as number | undefined);

  const updatedData: Record<string, unknown> = {
    ...variation.data,
    approvedBy:       ctx.userId,
    approvedAt:       now,
    ...(finalAmount !== undefined    ? { approvedAmount: finalAmount }    : {}),
    ...(timeExtension !== undefined  ? { timeExtension }                 : {}),
    ...(approvalComments             ? { approvalComments }              : {}),
  };

  await resourceService.updateResource(
    variationId, ctx.organizationId,
    { data: updatedData },
    ctx.userId,
  );

  // Ensure at under_review before approving
  if (variation.state === 'submitted') {
    await resourceService.transitionState(variationId, ctx.organizationId, 'under_review', ctx.userId);
  }

  const approved = await resourceService.transitionState(
    variationId, ctx.organizationId, 'approved', ctx.userId,
  );

  ctx.logger.info(
    `[construction.approve_variation] Variation ${variationId} approved — ` +
    `amount=${finalAmount ?? 'N/A'}, extension=${timeExtension ?? 0} days (state=${approved.state})`,
  );

  return {
    status: 'success',
    outputs: {
      variationId,
      approvedAmount:  finalAmount ?? null,
      timeExtension:   timeExtension ?? null,
      variationState:  approved.state,
    },
  };
}
