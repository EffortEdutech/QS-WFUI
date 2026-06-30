/**
 * finance.create_purchase_order
 *
 * Creates a PurchaseOrder resource and submits it for approval.
 * Used to raise purchase orders for materials, plant hire,
 * or subcontracted works on a construction project.
 *
 * Inputs:
 *   projectResourceId — parent construction_project resource ID (required)
 *   supplierName      — supplier / subcontractor name (required)
 *   description       — brief scope or item description (required)
 *   amount            — total PO value MYR (required)
 *   poNo              — PO reference e.g. "PO-2024-001" (optional)
 *   currency          — default MYR (optional)
 *   deliveryDate      — expected delivery ISO 8601 (optional)
 *   paymentTerms      — e.g. "30 days net" (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   purchaseOrderId     — created resource ID
 *   purchaseOrderState  — 'submitted'
 *   poNo                — PO reference number
 *   amount              — PO value
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService, PurchaseOrderData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realCreatePurchaseOrder(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const supplierName      = (inp['supplierName']      ?? cfg['supplierName'])      as string | undefined;
  const description       = (inp['description']       ?? cfg['description'])       as string | undefined;
  const amount            = (inp['amount']            ?? cfg['amount'])            as number | undefined;
  const poNo              = (inp['poNo']              ?? cfg['poNo'])              as string | undefined;
  const currency          = (inp['currency']          ?? cfg['currency'])          as string | undefined ?? 'MYR';
  const deliveryDate      = (inp['deliveryDate']      ?? cfg['deliveryDate'])      as string | undefined;
  const paymentTerms      = (inp['paymentTerms']      ?? cfg['paymentTerms'])      as string | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('finance.create_purchase_order: projectResourceId is required');
  if (!supplierName)      return err('finance.create_purchase_order: supplierName is required');
  if (!description)       return err('finance.create_purchase_order: description is required');
  if (amount === undefined || amount === null)
    return err('finance.create_purchase_order: amount is required');
  if (!ctx.organizationId) return err('finance.create_purchase_order: organizationId missing from context');
  if (!resourceService)    return err('finance.create_purchase_order: resourceService not injected');

  const now = new Date().toISOString();
  const data: PurchaseOrderData = {
    projectResourceId,
    supplierName,
    description,
    amount,
    currency,
    submittedBy:  ctx.userId,
    submittedAt:  now,
    ...(poNo          ? { poNo }          : {}),
    ...(deliveryDate  ? { deliveryDate }  : {}),
    ...(paymentTerms  ? { paymentTerms }  : {}),
  };

  const name = poNo
    ? `${poNo} — ${supplierName}`
    : `PO — ${supplierName}`;

  // Create in draft, then submit
  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'purchase_order',
    name,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  const submitted = await resourceService.transitionState(
    resource.id,
    ctx.organizationId,
    'submitted',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.create_purchase_order] Created PO "${name}" (id=${resource.id}, state=${submitted.state}, amount=${amount} ${currency})`,
  );

  return {
    status: 'success',
    outputs: {
      purchaseOrderId:    resource.id,
      purchaseOrderState: submitted.state,
      poNo:               poNo ?? '',
      amount,
    },
  };
}
