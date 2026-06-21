/**
 * contractor.create_maintenance_record  (M3 — Fleet Maintenance)
 *
 * Creates a MaintenanceRecord resource linked to a vehicle or equipment asset,
 * and transitions the asset to 'maintenance' state (blocking assignment).
 *
 * Inputs:
 *   assetId       — vehicle or equipment resource ID (required)
 *   assetType     — 'vehicle' | 'equipment' (required)
 *   description   — work description (required)
 *   scheduledDate — ISO 8601 date (optional)
 *   workshop      — workshop / vendor name (optional)
 *
 * Outputs:
 *   maintenanceRecordId — created MaintenanceRecord resource ID
 *   maintenanceState    — 'scheduled'
 *   assetState          — updated asset state ('maintenance')
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { MaintenanceRecordData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IMaintenanceCreateService {
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

export async function realCreateMaintenanceRecord(
  ctx: NodeContext,
  resourceService?: IMaintenanceCreateService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const assetId       = (inp['assetId']       as string | undefined) ?? (ctx.config['assetId']       as string | undefined);
  const assetType     = (inp['assetType']      as string | undefined) ?? (ctx.config['assetType']      as string | undefined);
  const description   = (inp['description']   as string | undefined) ?? (ctx.config['description']   as string | undefined);
  const scheduledDate = (inp['scheduledDate']  as string | undefined) ?? (ctx.config['scheduledDate']  as string | undefined);
  const workshop      = (inp['workshop']       as string | undefined) ?? (ctx.config['workshop']       as string | undefined);

  if (!assetId)            return err('contractor.create_maintenance_record: assetId is required');
  if (!assetType)          return err('contractor.create_maintenance_record: assetType is required');
  if (assetType !== 'vehicle' && assetType !== 'equipment')
    return err('contractor.create_maintenance_record: assetType must be vehicle or equipment');
  if (!description)        return err('contractor.create_maintenance_record: description is required');
  if (!ctx.organizationId) return err('contractor.create_maintenance_record: organizationId missing from context');
  if (!resourceService)    return err('contractor.create_maintenance_record: resourceService not injected');

  const data: MaintenanceRecordData = {
    assetId,
    assetType: assetType as 'vehicle' | 'equipment',
    description,
    ...(scheduledDate ? { scheduledDate } : {}),
    ...(workshop      ? { workshop }      : {}),
  };

  // 1. Create the maintenance record
  const record = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'maintenance_record',
    name:      `${assetType === 'vehicle' ? 'Vehicle' : 'Equipment'} Service — ${description.slice(0, 60)}`,
    data:      data as unknown as Record<string, unknown>,
    parentId:  assetId,
    createdBy: ctx.userId,
  });

  // 2. Transition the asset to 'maintenance' — blocks it from dispatch
  const asset = await resourceService.transitionState(
    assetId,
    ctx.organizationId,
    'maintenance',
    ctx.userId,
  );

  return {
    status: 'success',
    outputs: {
      maintenanceRecordId: record.id,
      maintenanceState:    record.state,
      assetState:          asset.state,
    },
  };
}
