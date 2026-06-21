/**
 * contractor.upload_fuel_receipt
 *
 * Creates a FuelReceipt resource from an uploaded file URL.
 * Optionally pre-fills known values (amount, liters, station).
 * Emits fuel_receipt.uploaded — downstream AI extraction node reads the
 * file and writes aiExtracted fields back, but a human MUST approve
 * before any values are used commercially.
 *
 * AI GUARDRAIL (non-negotiable):
 *   AI extraction is advisory only. No AI-extracted fuel cost or quantity
 *   may be posted to finance without owner/admin human approval.
 *   The receipt lands in 'pending_review' state and requires the
 *   foundation.request_approval node or manual state transition to proceed.
 *
 * Inputs:
 *   vehicleId    — vehicle resource ID (required)
 *   fileUrl      — URL of the uploaded receipt image/PDF (required)
 *   amount       — MYR amount if already known (optional)
 *   liters       — fuel quantity if already known (optional)
 *   stationName  — station name if already known (optional)
 *
 * Outputs:
 *   receiptId    — created fuel_receipt resource ID
 *   receiptState — 'pending_review'
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { FuelReceiptData } from '../types';
import type { IResourceService } from './contractor-create-job';

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realUploadFuelReceipt(
  ctx: NodeContext,
  resourceService?: IResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const vehicleId   = (inp['vehicleId']   as string | undefined) ?? (ctx.config['vehicleId']   as string | undefined);
  const fileUrl     = (inp['fileUrl']     as string | undefined) ?? (ctx.config['fileUrl']     as string | undefined);
  const amount      = (inp['amount']      as number | undefined) ?? (ctx.config['amount']      as number | undefined);
  const liters      = (inp['liters']      as number | undefined) ?? (ctx.config['liters']      as number | undefined);
  const stationName = (inp['stationName'] as string | undefined) ?? (ctx.config['stationName'] as string | undefined);

  if (!vehicleId)           return err('contractor.upload_fuel_receipt: vehicleId is required');
  if (!fileUrl)             return err('contractor.upload_fuel_receipt: fileUrl is required');
  if (!ctx.organizationId)  return err('contractor.upload_fuel_receipt: organizationId missing from context');
  if (!resourceService)     return err('contractor.upload_fuel_receipt: resourceService not injected');

  const data: FuelReceiptData = {
    vehicleId,
    fileUrl,
    ...(amount      !== undefined ? { amount }      : {}),
    ...(liters      !== undefined ? { liters }      : {}),
    ...(stationName               ? { stationName } : {}),
  };

  const receipt = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'fuel_receipt',
    name:      `Fuel Receipt — ${stationName ?? new Date().toLocaleDateString()}`,
    data:      { ...data } as Record<string, unknown>,
    parentId:  vehicleId,
    createdBy: ctx.userId,
  });

  // Receipt lands in 'pending_review' (initial state from state machine).
  // A subsequent foundation.request_approval node or manual owner action
  // advances it to 'approved'. AI extraction is triggered by a separate
  // event subscriber — its output is written to data.aiExtracted and
  // is explicitly marked advisory until human-reviewed.

  return {
    status: 'success',
    outputs: {
      receiptId:    receipt.id,
      receiptState: receipt.state,
    },
  };
}
