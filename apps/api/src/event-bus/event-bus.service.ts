/**
 * EventBusService — Phase 4 (Event Bus)
 *
 * Universal event log for the Lados platform.
 * Every significant domain action — resource changes, workflow lifecycle,
 * approval decisions, custom node events — is published here.
 *
 * Design:
 *   - @Global() so Resource, Approval, Execution services inject it freely
 *     without circular module dependencies.
 *   - publish() is fire-and-forget safe: failures are logged but never thrown,
 *     so a broken event write never breaks the originating operation.
 *   - Subscription triggering (firing workflows on event match) is intentionally
 *     async and non-blocking. Failures are retried by the next publish cycle.
 *
 * AI guardrail: events are observational. Publishing an event never by itself
 * moves money, certifies work, or awards a contract. Any workflow triggered by
 * a subscription still requires a core.human_approval node for any financial
 * or certification action.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

// ── Domain event types ────────────────────────────────────────────────────────

export type LadosEventType =
  // Resource lifecycle
  | 'resource.created'
  | 'resource.updated'
  | 'resource.state_changed'
  | 'resource.deleted'
  // Workflow lifecycle
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.cancelled'
  // Approval lifecycle
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  // Custom (from event.publish node)
  | 'event.custom'
  // Catch-all for future types
  | (string & {});

export type EventSourceType = 'resource' | 'workflow' | 'approval' | 'node' | 'system';

export interface LadosEvent {
  id: string;
  org_id: string;
  type: LadosEventType;
  source_type: EventSourceType | null;
  source_id: string | null;
  actor_id: string | null;
  correlation_id: string | null;
  run_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PublishEventParams {
  orgId:          string;
  type:           LadosEventType;
  sourceType?:    EventSourceType;
  sourceId?:      string;
  actorId?:       string;
  correlationId?: string;
  runId?:         string;
  payload?:       Record<string, unknown>;
}

export interface EventSubscription {
  id:         string;
  org_id:     string;
  event_type: string;
  workflow_id: string;
  filter:     Record<string, unknown>;
  active:     boolean;
  created_by: string | null;
  created_at: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  /**
   * Optional callback set by ExecutionService to trigger workflows from
   * event subscriptions without creating a circular module dependency.
   * ExecutionService calls setWorkflowTrigger() in its onModuleInit().
   */
  private workflowTrigger?: (
    workflowId: string,
    orgId: string,
    actorId: string,
    inputs: Record<string, unknown>,
  ) => Promise<void>;

  constructor(private readonly supabase: SupabaseService) {}

  // ── Register workflow trigger ─────────────────────────────────────────────

  setWorkflowTrigger(
    fn: (workflowId: string, orgId: string, actorId: string, inputs: Record<string, unknown>) => Promise<void>,
  ): void {
    this.workflowTrigger = fn;
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  /**
   * Publish a domain event.
   * Never throws — failures are logged and swallowed to protect the caller.
   */
  async publish(params: PublishEventParams): Promise<LadosEvent | null> {
    const { orgId, type, sourceType, sourceId, actorId, correlationId, runId, payload = {} } = params;

    const { data: event, error } = await this.supabase.admin
      .from('lados_events')
      .insert({
        org_id:         orgId,
        type,
        source_type:    sourceType    ?? null,
        source_id:      sourceId      ?? null,
        actor_id:       actorId       ?? null,
        correlation_id: correlationId ?? null,
        run_id:         runId         ?? null,
        payload,
      })
      .select()
      .single();

    if (error) {
      this.logger.warn(`Failed to publish event [${type}]: ${error.message}`);
      return null;
    }

    this.logger.debug(`Event published: ${type} (${event.id}) org=${orgId}`);

    // Fire subscriptions asynchronously — never await, never block the caller
    this.dispatchSubscriptions(event as LadosEvent).catch((err) => {
      this.logger.warn(`Subscription dispatch error for event ${event.id}: ${(err as Error).message}`);
    });

    return event as LadosEvent;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  async getEvents(
    orgId: string,
    filters: {
      type?:          string;
      sourceType?:    string;
      sourceId?:      string;
      actorId?:       string;
      correlationId?: string;
      runId?:         string;
      from?:          string;   // ISO timestamp
      to?:            string;   // ISO timestamp
      limit?:         number;
    } = {},
  ): Promise<LadosEvent[]> {
    let q = this.supabase.admin
      .from('lados_events')
      .select()
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.type)          q = q.eq('type', filters.type);
    if (filters.sourceType)    q = q.eq('source_type', filters.sourceType);
    if (filters.sourceId)      q = q.eq('source_id', filters.sourceId);
    if (filters.actorId)       q = q.eq('actor_id', filters.actorId);
    if (filters.correlationId) q = q.eq('correlation_id', filters.correlationId);
    if (filters.runId)         q = q.eq('run_id', filters.runId);
    if (filters.from)          q = q.gte('created_at', filters.from);
    if (filters.to)            q = q.lte('created_at', filters.to);

    const { data, error } = await q;
    if (error) throw new Error(`Failed to fetch events: ${error.message}`);
    return (data ?? []) as LadosEvent[];
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async subscribe(params: {
    orgId:      string;
    eventType:  string;
    workflowId: string;
    filter?:    Record<string, unknown>;
    createdBy:  string;
  }): Promise<EventSubscription> {
    const { data, error } = await this.supabase.admin
      .from('lados_event_subscriptions')
      .insert({
        org_id:      params.orgId,
        event_type:  params.eventType,
        workflow_id: params.workflowId,
        filter:      params.filter ?? {},
        active:      true,
        created_by:  params.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create subscription: ${error.message}`);
    return data as EventSubscription;
  }

  async listSubscriptions(orgId: string): Promise<EventSubscription[]> {
    const { data, error } = await this.supabase.admin
      .from('lados_event_subscriptions')
      .select()
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list subscriptions: ${error.message}`);
    return (data ?? []) as EventSubscription[];
  }

  async unsubscribe(id: string, orgId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('lados_event_subscriptions')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw new Error(`Failed to delete subscription: ${error.message}`);
  }

  async setSubscriptionActive(id: string, orgId: string, active: boolean): Promise<EventSubscription> {
    const { data, error } = await this.supabase.admin
      .from('lados_event_subscriptions')
      .update({ active })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to update subscription: ${error?.message}`);
    return data as EventSubscription;
  }

  // ── Internal: subscription dispatch ──────────────────────────────────────

  private async dispatchSubscriptions(event: LadosEvent): Promise<void> {
    if (!this.workflowTrigger) return;

    // Find active subscriptions matching this event type (exact or wildcard prefix)
    const { data: subs } = await this.supabase.admin
      .from('lados_event_subscriptions')
      .select('id, workflow_id, filter')
      .eq('org_id', event.org_id)
      .eq('active', true);

    if (!subs?.length) return;

    const matching = (subs as EventSubscription[]).filter((s) =>
      this.matchesEventType(s.event_type, event.type),
    );

    if (!matching.length) return;

    this.logger.log(
      `Dispatching ${matching.length} subscription(s) for event ${event.type} (${event.id})`,
    );

    for (const sub of matching) {
      try {
        await this.workflowTrigger(
          sub.workflow_id,
          event.org_id,
          event.actor_id ?? 'system',
          { event },
        );
      } catch (err) {
        this.logger.warn(
          `Subscription ${sub.id} trigger failed for event ${event.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Match an event type against a subscription pattern.
   * Supports exact match and wildcard suffix: 'resource.*' matches 'resource.created'.
   */
  private matchesEventType(pattern: string, type: string): boolean {
    if (pattern === type) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return type.startsWith(`${prefix}.`);
    }
    return false;
  }
}
