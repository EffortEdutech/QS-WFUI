/**
 * contractor.complete_trip
 *
 * Transitions a Trip resource from pending/in_progress → completed.
 * Records odometer reading and completion notes.
 *
 * Inputs:
 *   tripId       — trip resource ID (required)
 *   odometerEnd  — odometer at end of trip in km (optional)
 *   completedKm  — distance driven this trip in km (optional)
 *   notes        — completion notes (optional)
 *
 * Outputs:
 *   tripId    — the trip resource ID
 *   tripState — 'completed'
 *
 * Uses ctx.organizationId.
 * Downstream: emits trip.completed event which can trigger invoice generation.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Service interfaces ────────────────────────────────────────────────────────

/** Minimal subset of ResourceService needed by this node. */
export interface IResourceUpdateService {
  updateResource(
    id:         string,
    orgId:      string,
    updates:    { data?: Record<string, unknown> },
    updatedBy?: string,
  ): Promise<{ id: string }>;

  transitionState(
    id:        string,
    orgId:     string,
    toState:   string,
    actorId?:  string,
  ): Promise<{ id: string; state: string }>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realCompleteTrip(
  ctx: NodeContext,
  resourceService?: IResourceUpdateService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const tripId      = (inp['tripId']      as string | undefined) ?? (ctx.config['tripId']      as string | undefined);
  const odometerEnd = (inp['odometerEnd'] as number | undefined) ?? (ctx.config['odometerEnd'] as number | undefined);
  const completedKm = (inp['completedKm'] as number | undefined) ?? (ctx.config['completedKm'] as number | undefined);
  const notes       = (inp['notes']       as string | undefined) ?? (ctx.config['notes']       as string | undefined);

  if (!tripId)              return err('contractor.complete_trip: tripId is required');
  if (!ctx.organizationId)  return err('contractor.complete_trip: organizationId missing from context');
  if (!resourceService)     return err('contractor.complete_trip: resourceService not injected');

  // 1. Record completion data
  const updates: Record<string, unknown> = {};
  if (odometerEnd !== undefined) updates['odometerEnd'] = odometerEnd;
  if (completedKm !== undefined) updates['completedKm'] = completedKm;
  if (notes)                     updates['notes']        = notes;
  updates['completedAt'] = new Date().toISOString();

  if (Object.keys(updates).length > 0) {
    await resourceService.updateResource(tripId, ctx.organizationId, { data: updates }, ctx.userId);
  }

  // 2. Transition state → completed
  const updated = await resourceService.transitionState(
    tripId,
    ctx.organizationId,
    'completed',
    ctx.userId,
  );

  return {
    status: 'success',
    outputs: {
      tripId:    updated.id,
      tripState: updated.state,
    },
  };
}
