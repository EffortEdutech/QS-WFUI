/**
 * contractor.clear_maintenance  (M3 — Fleet Maintenance)
 *
 * Marks a MaintenanceRecord as completed and returns the linked asset
 * (vehicle or equipment) to 'available' state.
 *
 * Reads assetId and assetType from the maintenance record's data field,
 * so those do not need to be supplied by the caller.
 *
 * Inputs:
 *   maintenanceRecordId — maintenance record resource ID (required)
 *   completionNotes     — notes from workshop (optional)
 *   cost                — service cost in MYR (optional)
 *
 * Outputs:
 *   maintenanceRecordId — the maintenance record resource ID
 *   maintenanceState    — 'completed'
 *   assetId             — the cleared asset resource ID
 *   assetState          — 'available'
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IMaintenanceClearService {
  getResource(
    id:    string,
    orgId: string,
  ): Promise<{ id: string; state: string; data: Record<string, unknown> }>;

  updateResource(
    id:         string,
    orgId:      string,
    updates:    { data?: Record<string, unknown> },
    updatedBy?: string,
  ): Promise<{ id: string }>;

  transitionState(
    id:       string,
    orgId:    string,
    toState:  string,
    actorId?: string,
  ): Promise<{ id: string; state: string }>;
}

export async function realClearMaintenance(
  ctx: NodeContext,
  resourceService?: IMaintenanceClearService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const maintenanceRecordId = (inp['maintenanceRecordId'] as string | undefined) ?? (ctx.config['maintenanceRecordId'] as string | undefined);
  const completionNotes     = (inp['completionNotes']     as string | undefined) ?? (ctx.config['completionNotes']     as string | undefined);
  const cost                = (inp['cost']                as number | undefined) ?? (ctx.config['cost']                as number | undefined);

  if (!maintenanceRecordId) return err('contractor.clear_maintenance: maintenanceRecordId is required');
  if (!ctx.organizationId)  return err('contractor.clear_maintenance: organizationId missing from context');
  if (!resourceService)     return err('contractor.clear_maintenance: resourceService not injected');

  // 1. Read the maintenance record to get assetId + assetType
  const record = await resourceService.getResource(maintenanceRecordId, ctx.organizationId);
  const assetId = record.data['assetId'] as string | undefined;

  if (!assetId) {
    return err('contractor.clear_maintenance: maintenance record has no assetId in data');
  }

  // 2. Update maintenance record with completion details
  const completionData: Record<string, unknown> = {
    completedAt: new Date().toISOString(),
    ...(completionNotes ? { completionNotes } : {}),
    ...(cost != null    ? { cost }            : {}),
  };

  await resourceService.updateResource(
    maintenanceRecordId,
    ctx.organizationId,
    { data: completionData },
    ctx.userId,
  );

  // 3. Transition maintenance record → completed
  const updatedRecord = await resourceService.transitionState(
    maintenanceRecordId,
    ctx.organizationId,
    'completed',
    ctx.userId,
  );

  // 4. Transition asset → available
  const updatedAsset = await resourceService.transitionState(
    assetId,
    ctx.organizationId,
    'available',
    ctx.userId,
  );

  return {
    status: 'success',
    outputs: {
      maintenanceRecordId: updatedRecord.id,
      maintenanceState:    updatedRecord.state,
      assetId:             updatedAsset.id,
      assetState:          updatedAsset.state,
    },
  };
}
