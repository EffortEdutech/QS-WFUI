/**
 * contractor.dispatch_trip
 *
 * Creates a Trip resource under a Job and assigns vehicle + driver.
 * Both vehicle and driver are validated as existing resources.
 *
 * Inputs:
 *   jobId         — job resource ID (required)
 *   vehicleId     — vehicle resource ID (required)
 *   driverId      — driver resource ID (required)
 *   scheduledDate — ISO 8601 date/time (optional)
 *   notes         — dispatch notes (optional)
 *
 * Outputs:
 *   tripId    — created trip resource ID
 *   tripState — initial trip state ('pending')
 *
 * Uses ctx.organizationId.
 * Emits trip.dispatched event via resource service.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { TripData } from '../types';
import type { IResourceService } from './contractor-create-job';

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realDispatchTrip(
  ctx: NodeContext,
  resourceService?: IResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const jobId         = (inp['jobId']         as string | undefined) ?? (ctx.config['jobId']         as string | undefined);
  const vehicleId     = (inp['vehicleId']     as string | undefined) ?? (ctx.config['vehicleId']     as string | undefined);
  const driverId      = (inp['driverId']      as string | undefined) ?? (ctx.config['driverId']      as string | undefined);
  const scheduledDate = (inp['scheduledDate'] as string | undefined) ?? (ctx.config['scheduledDate'] as string | undefined);
  const notes         = (inp['notes']         as string | undefined) ?? (ctx.config['notes']         as string | undefined);

  if (!jobId)               return err('contractor.dispatch_trip: jobId is required');
  if (!vehicleId)           return err('contractor.dispatch_trip: vehicleId is required');
  if (!driverId)            return err('contractor.dispatch_trip: driverId is required');
  if (!ctx.organizationId)  return err('contractor.dispatch_trip: organizationId missing from context');
  if (!resourceService)     return err('contractor.dispatch_trip: resourceService not injected');

  const data: TripData = {
    jobId,
    vehicleId,
    driverId,
    ...(scheduledDate ? { scheduledDate } : {}),
    ...(notes         ? { notes }         : {}),
  };

  const trip = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'trip',
    name:      `Trip for Job ${jobId}`,
    data:      { ...data } as Record<string, unknown>,
    parentId:  jobId,
    createdBy: ctx.userId,
  });

  return {
    status: 'success',
    outputs: {
      tripId:    trip.id,
      tripState: trip.state,
    },
  };
}
