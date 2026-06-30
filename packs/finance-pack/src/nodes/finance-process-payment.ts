/**
 * finance.process_payment
 *
 * Records payment against an approved finance invoice.
 * Transitions state from 'approved' → 'paid'.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AI GUARDRAIL — NON-NEGOTIABLE                                  ║
 * ║  This node MUST appear DOWNSTREAM of foundation.request_approval ║
 * ║  in every workflow that uses it.                                 ║
 * ║  AI CANNOT release payment. Financial disbursement requires      ║
 * ║  explicit human authorisation recorded in the approval node.    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Inputs:
 *   invoiceId      — finance_invoice resource ID (required)
 *   paymentAmount  — amount paid MYR (required)
 *   paymentRef     — payment reference / cheque / transfer no (optional)
 *   paymentDate    — ISO 8601 payment date (optional, defaults to today)
 *   paymentMethod  — bank_transfer | cheque | online (optional)
 *
 * Outputs:
 *   invoiceId     — resource ID
 *   invoiceState  — 'paid'
 *   paidAmount    — amount paid
 *   paymentRef    — payment reference
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realProcessPayment(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const invoiceId     = (inp['invoiceId']     ?? cfg['invoiceId'])     as string | undefined;
  const paymentAmount = (inp['paymentAmount'] ?? cfg['paymentAmount']) as number | undefined;
  const paymentRef    = (inp['paymentRef']    ?? cfg['paymentRef'])    as string | undefined;
  const paymentDate   = (inp['paymentDate']   ?? cfg['paymentDate'])   as string | undefined ?? new Date().toISOString().split('T')[0];
  const paymentMethod = (inp['paymentMethod'] ?? cfg['paymentMethod']) as string | undefined ?? 'bank_transfer';

  if (!invoiceId)       return err('finance.process_payment: invoiceId is required');
  if (paymentAmount === undefined || paymentAmount === null)
    return err('finance.process_payment: paymentAmount is required');
  if (!ctx.organizationId) return err('finance.process_payment: organizationId missing from context');
  if (!resourceService)    return err('finance.process_payment: resourceService not injected');

  const invoice = await resourceService.findById(invoiceId, ctx.organizationId);
  if (!invoice) return err(`finance.process_payment: invoice ${invoiceId} not found`);
  if (invoice.state !== 'approved') {
    return err(`finance.process_payment: invoice must be in 'approved' state (current: ${invoice.state})`);
  }

  await resourceService.updateResource(
    invoiceId,
    ctx.organizationId,
    {
      data: {
        ...invoice.data,
        paidAmount:   paymentAmount,
        paymentDate,
        paymentMethod,
        paidBy:       ctx.userId,   // Must be human — AI guardrail
        ...(paymentRef ? { paymentRef } : {}),
      },
    },
    ctx.userId ?? 'system',
  );

  const paid = await resourceService.transitionState(
    invoiceId,
    ctx.organizationId,
    'paid',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.process_payment] Invoice ${invoiceId} marked paid — amount: ${paymentAmount}, ref: ${paymentRef ?? 'N/A'} (state: ${paid.state})`,
  );

  return {
    status: 'success',
    outputs: {
      invoiceId,
      invoiceState: paid.state,
      paidAmount:   paymentAmount,
      paymentRef:   paymentRef ?? '',
    },
  };
}
