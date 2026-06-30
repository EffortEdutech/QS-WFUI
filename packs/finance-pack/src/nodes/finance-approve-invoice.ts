/**
 * finance.approve_invoice
 *
 * PM / authorised signatory approval of a QS-verified invoice.
 * Transitions state from 'verified' → 'approved'.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AI GUARDRAIL — NON-NEGOTIABLE                                  ║
 * ║  This node MUST appear DOWNSTREAM of foundation.request_approval ║
 * ║  in every workflow that uses it. AI cannot approve invoices.    ║
 * ║  approval.decide is restricted to owner/admin roles only.       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Inputs:
 *   invoiceId         — finance_invoice resource ID (required)
 *   approvalComments  — PM approval notes (optional)
 *
 * Outputs:
 *   invoiceId       — resource ID
 *   invoiceState    — 'approved'
 *   approvedAmount  — amount carried from QS verification
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realApproveInvoice(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const invoiceId        = (inp['invoiceId']        ?? cfg['invoiceId'])        as string | undefined;
  const approvalComments = (inp['approvalComments'] ?? cfg['approvalComments']) as string | undefined;

  if (!invoiceId)          return err('finance.approve_invoice: invoiceId is required');
  if (!ctx.organizationId) return err('finance.approve_invoice: organizationId missing from context');
  if (!resourceService)    return err('finance.approve_invoice: resourceService not injected');

  const invoice = await resourceService.findById(invoiceId, ctx.organizationId);
  if (!invoice) return err(`finance.approve_invoice: invoice ${invoiceId} not found`);
  if (invoice.state !== 'verified') {
    return err(`finance.approve_invoice: invoice must be in 'verified' state (current: ${invoice.state})`);
  }

  const now = new Date().toISOString();
  const existingData = invoice.data as Record<string, unknown>;
  const approvedAmount = (existingData['verifiedAmount'] as number | undefined) ?? (existingData['invoiceAmount'] as number | undefined) ?? 0;

  await resourceService.updateResource(
    invoiceId,
    ctx.organizationId,
    {
      data: {
        ...existingData,
        approvedAmount,
        approvedBy:        ctx.userId,  // Must be human — AI guardrail
        approvedAt:        now,
        ...(approvalComments ? { approvalComments } : {}),
      },
    },
    ctx.userId ?? 'system',
  );

  const approved = await resourceService.transitionState(
    invoiceId,
    ctx.organizationId,
    'approved',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.approve_invoice] Invoice ${invoiceId} approved (amount: ${approvedAmount}, state: ${approved.state}) — human approval required upstream`,
  );

  return {
    status: 'success',
    outputs: {
      invoiceId,
      invoiceState:   approved.state,
      approvedAmount,
    },
  };
}
