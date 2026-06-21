/**
 * contractor.record_payment  (M2 — Finance)
 *
 * Records a payment received against an Invoice.
 * Creates a Payment resource (state: pending → recorded by owner action).
 * Also transitions the Invoice to pending_reconciliation.
 *
 * AI guardrail: system never initiates bank transfer. Owner records what
 * was actually received in their bank account.
 *
 * Inputs:
 *   invoiceId  — invoice resource ID (required)
 *   amount     — amount received in MYR (required)
 *   method     — bank_transfer | cash | cheque | online (optional)
 *   reference  — bank / cheque reference number (optional)
 *   notes      — notes (optional)
 *
 * Outputs:
 *   paymentId    — created Payment resource ID
 *   paymentState — 'pending'
 *   invoiceState — updated invoice state
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { PaymentData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IPaymentResourceService {
  create(params: {
    orgId:      string;
    type:       string;
    name:       string;
    data?:      Record<string, unknown>;
    parentId?:  string;
    createdBy?: string;
  }): Promise<{ id: string; state: string }>;

  transitionState(
    id:       string,
    orgId:    string,
    toState:  string,
    actorId?: string,
  ): Promise<{ id: string; state: string }>;
}

export async function realRecordPayment(
  ctx: NodeContext,
  resourceService?: IPaymentResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const invoiceId = (inp['invoiceId'] as string | undefined) ?? (ctx.config['invoiceId'] as string | undefined);
  const amount    = (inp['amount']    as number | undefined) ?? (ctx.config['amount']    as number | undefined);
  const method    = (inp['method']    as string | undefined) ?? (ctx.config['method']    as string | undefined);
  const reference = (inp['reference'] as string | undefined) ?? (ctx.config['reference'] as string | undefined);
  const notes     = (inp['notes']     as string | undefined) ?? (ctx.config['notes']     as string | undefined);

  if (!invoiceId)          return err('contractor.record_payment: invoiceId is required');
  if (amount == null)      return err('contractor.record_payment: amount is required');
  if (!ctx.organizationId) return err('contractor.record_payment: organizationId missing from context');
  if (!resourceService)    return err('contractor.record_payment: resourceService not injected');

  const data: PaymentData = {
    invoiceId,
    amount,
    receivedAt: new Date().toISOString(),
    ...(method    ? { method: method as PaymentData['method'] } : {}),
    ...(reference ? { reference } : {}),
    ...(notes     ? { notes }     : {}),
  };

  // 1. Create the Payment resource (initial state: pending)
  const payment = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'payment',
    name:      `Payment for invoice ${invoiceId} — MYR ${amount.toFixed(2)}`,
    data:      data as unknown as Record<string, unknown>,
    parentId:  invoiceId,
    createdBy: ctx.userId,
  });

  // 2. Immediately transition payment → recorded (owner confirmed receipt)
  const recorded = await resourceService.transitionState(
    payment.id,
    ctx.organizationId,
    'recorded',
    ctx.userId,
  );

  // 3. Transition invoice → pending_reconciliation
  let invoiceState = 'unknown';
  try {
    const inv = await resourceService.transitionState(
      invoiceId,
      ctx.organizationId,
      'pending_reconciliation',
      ctx.userId,
    );
    invoiceState = inv.state;
  } catch {
    // Invoice may already be in a state that blocks this transition.
    // Non-fatal: payment is still created.
  }

  return {
    status: 'success',
    outputs: {
      paymentId:    recorded.id,
      paymentState: recorded.state,
      invoiceState,
    },
  };
}
