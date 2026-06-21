/**
 * ResourceService — Phase 3 (Resource Engine) / Phase 5 (State Engine)
 *
 * Generic resource store for the Lados platform.
 * Handles CRUD, and delegates state transitions to StateEngineService.
 *
 * Phase 5 changes:
 *   - ResourceType expanded to include Contractor Edition types:
 *     trip, invoice, payment
 *   - transitionState() now delegates to StateEngineService.executeTransition()
 *     which loads configurable machine definitions from lados_state_machines.
 *   - Hardcoded STATE_MACHINES and DEFAULT_STATE replaced by DB lookup.
 *
 * AI guardrail: this service does NOT make decisions about resource state.
 * All transitions are triggered by authenticated human users or approved
 * workflow nodes. No AI output may directly call transitionState().
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { StateEngineService } from '../state-engine/state-engine.service';

// ── Resource types ────────────────────────────────────────────────────────────

/** Phase 9 M1–M4: full Contractor Edition type list */
export type ResourceType =
  // Core (Phase 3)
  | 'job' | 'fleet' | 'worker' | 'material' | 'site'
  // Phase 5
  | 'trip' | 'invoice' | 'payment'
  // Phase 9 M1 — Contractor Edition
  | 'customer' | 'driver' | 'vehicle' | 'equipment'
  | 'fuel_receipt' | 'maintenance_record' | 'expense'
  // Phase 9 M3 — Fleet / Equipment operators
  | 'operator'
  // Phase 9 M4 — HR / Payroll
  | 'payroll_run'
  // escape hatch
  | 'custom';

export interface Resource {
  id: string;
  org_id: string;
  project_id: string | null;
  type: ResourceType;
  name: string;
  state: string;
  data: Record<string, unknown>;
  parent_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceEvent {
  id: string;
  resource_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Phase 5: STATE_MACHINES removed — definitions now live in lados_state_machines (DB).
// StateEngineService loads them dynamically and validates all transitions.

/** Default initial state per resource type (Phase 9: full Contractor Edition) */
const DEFAULT_STATE: Record<ResourceType, string> = {
  // Core
  job:                'draft',
  fleet:              'available',
  worker:             'available',
  material:           'available',
  site:               'preparation',
  // Phase 5
  trip:               'pending',
  invoice:            'draft',
  payment:            'scheduled',
  // Phase 9 — Contractor Edition
  customer:           'active',
  driver:             'available',
  vehicle:            'available',
  equipment:          'available',
  fuel_receipt:       'pending_review',
  maintenance_record: 'scheduled',
  expense:            'draft',
  // Phase 9 M3 / M4
  operator:           'available',
  payroll_run:        'draft',
  // escape hatch
  custom:             'active',
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventBus: EventBusService,
    private readonly stateEngine: StateEngineService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async createResource(params: {
    orgId: string;
    projectId?: string;
    type: ResourceType;
    name: string;
    data?: Record<string, unknown>;
    parentId?: string;
    createdBy: string;
  }): Promise<Resource> {
    const { orgId, projectId, type, name, data = {}, parentId, createdBy } = params;
    const initialState = DEFAULT_STATE[type] ?? 'draft';

    const { data: row, error } = await this.supabase.admin
      .from('lados_resources')
      .insert({
        org_id:     orgId,
        project_id: projectId ?? null,
        type,
        name,
        state:      initialState,
        data,
        parent_id:  parentId ?? null,
        created_by: createdBy,
        updated_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(`Failed to create resource: ${error.message}`);

    await this.recordEvent({
      resourceId: row.id,
      eventType:  'created',
      toState:    initialState,
      actorId:    createdBy,
      metadata:   { type, name },
    });

    this.logger.log(`Resource created: ${row.id} [${type}] "${name}" → ${initialState}`);

    void this.eventBus.publish({
      orgId: orgId, type: 'resource.created',
      sourceType: 'resource', sourceId: row.id, actorId: createdBy,
      payload: { resourceType: type, name, state: initialState },
    });

    return row as Resource;
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async getResource(id: string, orgId: string): Promise<Resource> {
    const { data: row, error } = await this.supabase.admin
      .from('lados_resources')
      .select()
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !row) throw new NotFoundException(`Resource ${id} not found`);
    return row as Resource;
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async listResources(
    orgId: string,
    filters: {
      type?:      ResourceType;
      state?:     string;
      projectId?: string;
      parentId?:  string;
      limit?:     number;
    } = {},
  ): Promise<Resource[]> {
    let q = this.supabase.admin
      .from('lados_resources')
      .select()
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.type)      q = q.eq('type', filters.type);
    if (filters.state)     q = q.eq('state', filters.state);
    if (filters.projectId) q = q.eq('project_id', filters.projectId);
    if (filters.parentId)  q = q.eq('parent_id', filters.parentId);

    const { data, error } = await q;
    if (error) throw new BadRequestException(`Failed to list resources: ${error.message}`);
    return (data ?? []) as Resource[];
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async updateResource(
    id: string,
    orgId: string,
    updates: {
      name?:      string;
      data?:      Record<string, unknown>;
      projectId?: string | null;
      parentId?:  string | null;
    },
    actorId: string,
  ): Promise<Resource> {
    const patch: Record<string, unknown> = { updated_by: actorId };
    if (updates.name      !== undefined) patch['name']       = updates.name;
    if (updates.data      !== undefined) patch['data']       = updates.data;
    if (updates.projectId !== undefined) patch['project_id'] = updates.projectId;
    if (updates.parentId  !== undefined) patch['parent_id']  = updates.parentId;

    const { data: row, error } = await this.supabase.admin
      .from('lados_resources')
      .update(patch)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !row) throw new NotFoundException(`Resource ${id} not found or update failed`);

    await this.recordEvent({
      resourceId: id,
      eventType:  'updated',
      actorId,
      metadata:   { fields: Object.keys(updates) },
    });

    void this.eventBus.publish({
      orgId, type: 'resource.updated',
      sourceType: 'resource', sourceId: id, actorId,
      payload: { fields: Object.keys(updates) },
    });

    return row as Resource;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteResource(id: string, orgId: string, actorId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('lados_resources')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw new BadRequestException(`Failed to delete resource: ${error.message}`);
    this.logger.log(`Resource deleted: ${id} by ${actorId}`);

    void this.eventBus.publish({
      orgId, type: 'resource.deleted',
      sourceType: 'resource', sourceId: id, actorId,
      payload: {},
    });
  }

  // ── State transition (Phase 5: delegates to StateEngine) ───────────────────

  /**
   * Transition a resource state via the StateEngine.
   * The StateEngine loads the configured state machine, evaluates guards,
   * applies the change, and fires actions.
   *
   * Returns the updated resource on success.
   * Throws BadRequestException for invalid transitions or blocked guards.
   * Throws an error with { approvalRequired: true, approvalTaskId } when
   * an approval guard is triggered — callers should redirect to the approval flow.
   *
   * AI guardrail: this method does not auto-approve. All approval-gated
   * transitions must be resolved by a human via the Approval Inbox.
   */
  async transitionState(
    id: string,
    orgId: string,
    toState: string,
    actorId: string,
    options?: {
      actorRole?:  string;
      executionId?: string;
      workflowId?:  string;
      projectId?:   string;
    },
  ): Promise<Resource & { approvalRequired?: boolean; approvalTaskId?: string }> {
    const resource  = await this.getResource(id, orgId);
    const fromState = resource.state;

    const result = await this.stateEngine.executeTransition({
      resourceId:   id,
      orgId,
      fromState,
      resourceType: resource.type,
      toState,
      actorId,
      actorRole:    options?.actorRole,
      executionId:  options?.executionId,
      workflowId:   options?.workflowId,
      projectId:    options?.projectId,
    });

    if (result.status === 'blocked') {
      throw new BadRequestException(result.reason);
    }

    if (result.status === 'approval_required') {
      // Return the resource unchanged with approval metadata
      return {
        ...resource,
        approvalRequired: true,
        approvalTaskId:   result.approvalTaskId,
      };
    }

    // status === 'completed' — return fresh resource from DB
    return await this.getResource(id, orgId) as Resource & { approvalRequired?: boolean };
  }

  // ── Event history ───────────────────────────────────────────────────────────

  async getEvents(resourceId: string, orgId: string): Promise<ResourceEvent[]> {
    // Verify org ownership first
    await this.getResource(resourceId, orgId);

    const { data, error } = await this.supabase.admin
      .from('lados_resource_events')
      .select()
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(`Failed to fetch events: ${error.message}`);
    return (data ?? []) as ResourceEvent[];
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async recordEvent(params: {
    resourceId: string;
    eventType:  string;
    fromState?: string;
    toState?:   string;
    actorId?:   string;
    metadata:   Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.admin
      .from('lados_resource_events')
      .insert({
        resource_id: params.resourceId,
        event_type:  params.eventType,
        from_state:  params.fromState ?? null,
        to_state:    params.toState   ?? null,
        actor_id:    params.actorId   ?? null,
        metadata:    params.metadata,
      });

    if (error) {
      this.logger.warn(`Failed to record resource event: ${error.message}`);
    }
  }
}
