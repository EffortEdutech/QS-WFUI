/**
 * finance.approve_purchase_order
 *
 * Approves a submitted Purchase Order and transitions it to 'approved'.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AI GUARDRAIL — NON-NEGOTIABLE                                  ║
 * ║  This node MUST appear DOWNSTREAM of foundation.request_approval ║
 * ║  AI cannot approve purchase orders — financial commitment        ║
 * ║  requires explicit human authorisation.                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Inputs:
 *   purchaseOrderId   — purchase_order resource ID (required)
 *   approvalComments  — approver's notes (optional)
 *
 * Outputs:
 *   purchaseOrderId     — resource ID
 *   purchaseOrderState  — 'approved'
 *   amount              — PO value carried forward
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realApprovePurchaseOrder(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const purchaseOrderId  = (inp['purchaseOrderId']  ?? cfg['purchaseOrderId'])  as string | undefined;
  const approvalComments = (inp['approvalComments'] ?? cfg['approvalComments']) as string | undefined;

  if (!purchaseOrderId)    return err('finance.approve_purchase_order: purchaseOrderId is required');
  if (!ctx.organizationId) return err('finance.approve_purchase_order: organizationId missing from context');
  if (!resourceService)    return err('finance.approve_purchase_order: resourceService not injected');

  const po = await resourceService.findById(purchaseOrderId, ctx.organizationId);
  if (!po) return err(`finance.approve_purchase_order: purchase order ${purchaseOrderId} not found`);
  if (po.state !== 'submitted') {
    return err(`finance.approve_purchase_order: PO must be in 'submitted' state (current: ${po.state})`);
  }

  const now = new Date().toISOString();
  const existingData = po.data as Record<string, unknown>;
  const amount = existingData['amount'] as number | undefined ?? 0;

  await resourceService.updateResource(
    purchaseOrderId,
    ctx.organizationId,
    {
      data: {
        ...existingData,
        approvedBy:  ctx.userId,  // Must be human — AI guardrail
        approvedAt:  now,
        ...(approvalComments ? { approvalComments } : {}),
      },
    },
    ctx.userId ?? 'system',
  );

  const approved = await resourceService.transitionState(
    purchaseOrderId,
    ctx.organizationId,
    'approved',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.approve_purchase_order] PO ${purchaseOrderId} approved (amount: ${amount}, state: ${approved.state}) — human approval required upstream`,
  );

  return {
    status: 'success',
    outputs: {
      purchaseOrderId,
      purchaseOrderState: approved.state,
      amount,
    },
  };
}
