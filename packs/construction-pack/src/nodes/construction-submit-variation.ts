/**
 * construction.submit_variation
 *
 * Creates a Variation (VO / contract change order) resource linked to a
 * ConstructionProject and immediately transitions it to 'submitted'.
 *
 * Inputs:
 *   projectResourceId — construction_project resource ID (required)
 *   reason            — reason / justification for the variation (required)
 *   variationNo       — variation reference number e.g. "VO-001" (optional)
 *   description       — detailed description of the change (optional)
 *   costImpact        — cost impact in MYR; positive = addition, negative = omission (optional)
 *   timeImpact        — time impact in calendar days (optional)
 *   currency          — default 'MYR' (optional)
 *   supportingDocs    — array of file URLs (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   variationId     — created variation resource ID
 *   variationState  — state after submission ('submitted')
 *   variationNo     — variation reference number
 *   costImpact      — stated cost impact
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService, VariationData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realSubmitVariation(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const reason            = (inp['reason']            ?? cfg['reason'])            as string | undefined;
  const variationNo       = (inp['variationNo']       ?? cfg['variationNo'])       as string | undefined;
  const description       = (inp['description']       ?? cfg['description'])       as string | undefined;
  const costImpact        = (inp['costImpact']        ?? cfg['costImpact'])        as number | undefined;
  const timeImpact        = (inp['timeImpact']        ?? cfg['timeImpact'])        as number | undefined;
  const currency          = (inp['currency']          ?? cfg['currency'])          as string | undefined ?? 'MYR';
  const supportingDocs    = (inp['supportingDocs']    ?? cfg['supportingDocs'])    as string[] | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('construction.submit_variation: projectResourceId is required');
  if (!reason)            return err('construction.submit_variation: reason is required');
  if (!ctx.organizationId) return err('construction.submit_variation: organizationId missing from context');
  if (!resourceService)   return err('construction.submit_variation: resourceService not injected');

  const now   = new Date().toISOString();
  const label = variationNo ?? `VO-${Date.now()}`;

  const data: VariationData = {
    projectResourceId,
    reason,
    ...(variationNo    ? { variationNo }    : {}),
    ...(description    ? { description }    : {}),
    ...(costImpact !== undefined ? { costImpact } : {}),
    ...(timeImpact !== undefined ? { timeImpact } : {}),
    currency,
    ...(supportingDocs ? { supportingDocs } : {}),
    submittedBy: ctx.userId,
    submittedAt: now,
  };

  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'variation',
    name:      label,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  const submitted = await resourceService.transitionState(
    resource.id, ctx.organizationId, 'submitted', ctx.userId,
  );

  ctx.logger.info(
    `[construction.submit_variation] Variation "${label}" submitted ` +
    `(id=${submitted.id}, state=${submitted.state}, costImpact=${costImpact ?? 'N/A'})`,
  );

  return {
    status: 'success',
    outputs: {
      variationId:    submitted.id,
      variationState: submitted.state,
      variationNo:    label,
      costImpact:     costImpact ?? null,
    },
  };
}
