/**
 * finance.process_retention_release
 *
 * Records actual release / disbursement of retention monies.
 * Transitions retention_release from 'approved' → 'released'.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AI GUARDRAIL — NON-NEGOTIABLE                                  ║
 * ║  This node MUST appear DOWNSTREAM of foundation.request_approval ║
 * ║  AI CANNOT release retention funds. Financial disbursement      ║
 * ║  requires explicit human authorisation.                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Inputs:
 *   retentionId    — retention_release resource ID (required)
 *   releaseAmount  — actual amount released MYR (required)
 *   releaseRef     — payment reference / cheque no (optional)
 *   releaseDate    — ISO 8601 release date (optional, defaults to today)
 *
 * Outputs:
 *   retentionId     — resource ID
 *   retentionState  — 'released'
 *   releaseAmount   — amount released
 *   releaseRef      — payment reference
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realProcessRetentionRelease(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const retentionId   = (inp['retentionId']   ?? cfg['retentionId'])   as string | undefined;
  const releaseAmount = (inp['releaseAmount'] ?? cfg['releaseAmount']) as number | undefined;
  const releaseRef    = (inp['releaseRef']    ?? cfg['releaseRef'])    as string | undefined;
  const releaseDate   = (inp['releaseDate']   ?? cfg['releaseDate'])   as string | undefined ?? new Date().toISOString().split('T')[0];

  if (!retentionId)     return err('finance.process_retention_release: retentionId is required');
  if (releaseAmount === undefined || releaseAmount === null)
    return err('finance.process_retention_release: releaseAmount is required');
  if (!ctx.organizationId) return err('finance.process_retention_release: organizationId missing from context');
  if (!resourceService)    return err('finance.process_retention_release: resourceService not injected');

  const retention = await resourceService.findById(retentionId, ctx.organizationId);
  if (!retention) return err(`finance.process_retention_release: retention record ${retentionId} not found`);
  if (retention.state !== 'approved') {
    return err(`finance.process_retention_release: retention must be in 'approved' state (current: ${retention.state})`);
  }

  await resourceService.updateResource(
    retentionId,
    ctx.organizationId,
    {
      data: {
        ...retention.data,
        releaseAmount,
        releaseDate,
        releasedBy:  ctx.userId,  // Must be human — AI guardrail
        ...(releaseRef ? { releaseRef } : {}),
      },
    },
    ctx.userId ?? 'system',
  );

  const released = await resourceService.transitionState(
    retentionId,
    ctx.organizationId,
    'released',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.process_retention_release] Retention ${retentionId} released — amount: ${releaseAmount}, ref: ${releaseRef ?? 'N/A'} (state: ${released.state})`,
  );

  return {
    status: 'success',
    outputs: {
      retentionId,
      retentionState: released.state,
      releaseAmount,
      releaseRef:     releaseRef ?? '',
    },
  };
}
