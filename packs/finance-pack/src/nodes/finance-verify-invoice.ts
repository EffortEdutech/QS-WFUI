/**
 * finance.verify_invoice
 *
 * QS verification of a submitted finance invoice.
 * Records the verified (QS-assessed) amount and transitions state
 * from 'submitted' → 'verified'.
 *
 * This node represents the Quantity Surveyor's assessment step.
 * The QS may certify the full amount or a reduced amount based on
 * work completed against the BOQ.
 *
 * Inputs:
 *   invoiceId          — finance_invoice resource ID (required)
 *   verifiedAmount     — QS-certified amount MYR (required)
 *   verificationNotes  — QS assessment remarks (optional)
 *
 * Outputs:
 *   invoiceId      — resource ID
 *   invoiceState   — 'verified'
 *   verifiedAmount — QS-certified amount
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realVerifyInvoice(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const invoiceId         = (inp['invoiceId']         ?? cfg['invoiceId'])         as string | undefined;
  const verifiedAmount    = (inp['verifiedAmount']    ?? cfg['verifiedAmount'])    as number | undefined;
  const verificationNotes = (inp['verificationNotes'] ?? cfg['verificationNotes']) as string | undefined;

  if (!invoiceId)       return err('finance.verify_invoice: invoiceId is required');
  if (verifiedAmount === undefined || verifiedAmount === null)
    return err('finance.verify_invoice: verifiedAmount is required');
  if (!ctx.organizationId) return err('finance.verify_invoice: organizationId missing from context');
  if (!resourceService)    return err('finance.verify_invoice: resourceService not injected');

  const invoice = await resourceService.findById(invoiceId, ctx.organizationId);
  if (!invoice) return err(`finance.verify_invoice: invoice ${invoiceId} not found`);
  if (invoice.state !== 'submitted') {
    return err(`finance.verify_invoice: invoice must be in 'submitted' state (current: ${invoice.state})`);
  }

  const now = new Date().toISOString();
  const updates = {
    data: {
      ...invoice.data,
      verifiedAmount,
      verifiedBy:  ctx.userId,
      verifiedAt:  now,
      ...(verificationNotes ? { verificationNotes } : {}),
    },
  };

  await resourceService.updateResource(invoiceId, ctx.organizationId, updates, ctx.userId ?? 'system');

  const verified = await resourceService.transitionState(
    invoiceId,
    ctx.organizationId,
    'verified',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.verify_invoice] Invoice ${invoiceId} verified by QS — amount: ${verifiedAmount} (state: ${verified.state})`,
  );

  return {
    status: 'success',
    outputs: {
      invoiceId,
      invoiceState:  verified.state,
      verifiedAmount,
    },
  };
}
