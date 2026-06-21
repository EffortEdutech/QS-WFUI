/**
 * event.publish node — Phase 4 (Event Bus)
 *
 * Lets workflow authors emit a custom domain event from within
 * a workflow execution. The event is published to lados_events and
 * dispatches any matching subscriptions.
 *
 * AI guardrail: publishing an event is observational only. Events cannot
 * by themselves approve, certify, release payment, or create commercial facts.
 * Any workflow triggered by a subscription still requires core.human_approval
 * for any consequential action.
 *
 * Node inputs:
 *   eventType  string  — the event type to emit (e.g. 'event.custom' or any domain type)
 *   payload    object  — arbitrary key/value data attached to the event
 *   sourceId   string? — optional ID of the thing that caused this event
 *
 * Node outputs:
 *   eventId    string | null  — the persisted event ID (null if publish failed)
 *   published  boolean        — whether the event was written to the log
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IEventBusService {
  publish(params: {
    orgId:       string;
    type:        string;
    sourceType?: string;
    sourceId?:   string;
    actorId?:    string;
    payload?:    Record<string, unknown>;
  }): Promise<{ id: string } | null>;
}

export async function realEventPublish(
  ctx: NodeContext,
  eventBus: IEventBusService,
): Promise<NodeExecuteResult> {
  const eventType = ctx.inputs['eventType'] as string | undefined;
  const payload   = (ctx.inputs['payload'] as Record<string, unknown> | undefined) ?? {};
  const sourceId  = ctx.inputs['sourceId'] as string | undefined;

  if (!eventType) {
    return {
      status:  'failure',
      outputs: { eventId: null, published: false },
      error:   { code: 'MISSING_INPUT', message: 'eventType is required' },
    };
  }

  const orgId = ctx.organizationId;
  if (!orgId) {
    return {
      status:  'failure',
      outputs: { eventId: null, published: false },
      error:   { code: 'NO_ORG', message: 'organizationId missing from execution context' },
    };
  }

  const event = await eventBus.publish({
    orgId,
    type:       eventType,
    sourceType: 'node',
    sourceId,
    actorId:    ctx.userId,
    payload,
  });

  return {
    status:  'success',
    outputs: { eventId: event?.id ?? null, published: event !== null },
  };
}
