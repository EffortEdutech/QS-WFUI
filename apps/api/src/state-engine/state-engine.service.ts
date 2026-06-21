/**
 * StateEngineService — Phase 5 (State Engine)
 *
 * Single gatekeeper for all resource state transitions.
 * Loads state machine definitions from lados_state_machines (DB),
 * falling back to null if no definition is found (transitions are
 * then allowed unconditionally for backward compat with custom types).
 *
 * Transition pipeline:
 *   1. loadMachine  — fetch definition from DB (org-specific → system default)
 *   2. validate     — check fromState→toState exists in the machine
 *   3. checkGuards  — per-transition guard evaluation
 *   4. applyChange  — update resource state in DB + record event
 *   5. runActions   — emit event, notify (fire-and-forget)
 *
 * Guards:
 *   requires_role      — org member must have the specified role
 *   requires_approval  — create an approval_task + return approval_required
 *
 * Actions (post-transition):
 *   emit_event — publish to EventBusService
 *   notify     — send in-app notification (not yet wired — future)
 *
 * AI guardrail: StateEngine never auto-approves. requires_approval guard
 * always routes to a human reviewer. AI output may not satisfy this guard.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { EventBusService } from '../event-bus/event-bus.service';
import type {
  StateMachineDefinition,
  TransitionDefinition,
  TransitionResult,
} from './state-engine.types';

// ── Fallback in-code machines ─────────────────────────────────────────────────
// Used when the DB has no record for a resource type (shouldn't normally happen
// after seeding, but provides safety for unknown/custom types).

const FALLBACK_MACHINE: StateMachineDefinition = {
  initial:     'active',
  states:      {},
  transitions: [],   // empty = allow all transitions for custom
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class StateEngineService {
  private readonly logger = new Logger(StateEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Load machine ─────────────────────────────────────────────────────────

  /**
   * Load state machine definition for a resource type.
   * Priority: org-specific → system default (org_id IS NULL) → fallback.
   */
  async loadMachine(
    resourceType: string,
    orgId: string,
  ): Promise<StateMachineDefinition> {
    // Try org-specific first
    const { data: orgMachine } = await this.supabase.admin
      .from('lados_state_machines')
      .select('definition')
      .eq('org_id', orgId)
      .eq('resource_type', resourceType)
      .eq('active', true)
      .maybeSingle();

    if (orgMachine?.['definition']) {
      return orgMachine['definition'] as StateMachineDefinition;
    }

    // Fall back to system default (org_id IS NULL)
    const { data: sysMachine } = await this.supabase.admin
      .from('lados_state_machines')
      .select('definition')
      .is('org_id', null)
      .eq('resource_type', resourceType)
      .eq('active', true)
      .maybeSingle();

    if (sysMachine?.['definition']) {
      return sysMachine['definition'] as StateMachineDefinition;
    }

    this.logger.warn(`No state machine found for resource type "${resourceType}" — using fallback`);
    return FALLBACK_MACHINE;
  }

  // ── Validate transition ───────────────────────────────────────────────────

  /**
   * Pure validation — does this from→to pair exist in the machine?
   * Empty transitions list = custom type; all transitions allowed.
   */
  findTransition(
    machine: StateMachineDefinition,
    fromState: string,
    toState: string,
  ): TransitionDefinition | null {
    if (machine.transitions.length === 0) return null; // custom type — no enforcement
    return machine.transitions.find(
      (t) => t.from === fromState && t.to === toState,
    ) ?? null;
  }

  validateTransition(
    machine: StateMachineDefinition,
    fromState: string,
    toState: string,
  ): void {
    if (machine.transitions.length === 0) return; // custom
    const transition = this.findTransition(machine, fromState, toState);
    if (!transition) {
      const allowed = machine.transitions
        .filter((t) => t.from === fromState)
        .map((t) => t.to);
      throw new BadRequestException(
        `Invalid transition: ${fromState} → ${toState}. ` +
        `Allowed: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }

  // ── Full executeTransition (with guards) ──────────────────────────────────

  /**
   * Execute a state transition through the full pipeline:
   * validate → guards → apply → actions.
   *
   * Returns:
   *   { status: 'completed' }           — transition applied
   *   { status: 'approval_required' }   — guard blocked; approval task created
   *   { status: 'blocked' }             — guard blocked without approval path
   */
  async executeTransition(params: {
    resourceId:   string;
    orgId:        string;
    fromState:    string;
    resourceType: string;
    toState:      string;
    actorId:      string;
    /** Org member role of the actor (used for requires_role guard) */
    actorRole?:   string;
    /** If inside a workflow execution, attach to the approval task */
    executionId?:  string;
    workflowId?:   string;
    projectId?:    string;
  }): Promise<TransitionResult> {
    const {
      resourceId, orgId, fromState, resourceType,
      toState, actorId, actorRole,
      executionId, workflowId, projectId,
    } = params;

    const machine = await this.loadMachine(resourceType, orgId);

    // 1. Validate the transition exists
    this.validateTransition(machine, fromState, toState);
    const transition = this.findTransition(machine, fromState, toState);

    // 2. Check guards
    if (transition?.guards?.length) {
      for (const guard of transition.guards) {
        if (guard.type === 'requires_role') {
          const resolvedRole = actorRole ?? (await this.getActorRole(actorId, orgId));
          const roles: string[] = ['owner', 'admin', 'member', 'driver', 'operator'];
          const requiredIdx = roles.indexOf(guard.role);
          const actorIdx    = roles.indexOf(resolvedRole ?? '');
          if (actorIdx === -1 || actorIdx > requiredIdx) {
            return {
              status: 'blocked',
              reason: `Transition requires role "${guard.role}" or higher`,
            };
          }
        }

        if (guard.type === 'requires_approval') {
          const approvalTaskId = await this.createApprovalTask({
            orgId, resourceId, resourceType,
            fromState, toState,
            actorId,
            title:        guard.title,
            description:  guard.description,
            assigneeRole: guard.assigneeRole ?? 'owner',
            executionId,
            workflowId,
            projectId,
          });
          return { status: 'approval_required', approvalTaskId, pendingToState: toState };
        }
      }
    }

    // 3. Apply the transition
    await this.applyTransition({ resourceId, orgId, fromState, toState, actorId });

    // 4. Run actions (fire-and-forget)
    if (transition?.actions?.length) {
      void this.runActions(transition.actions, { orgId, resourceId, fromState, toState, actorId });
    }

    return { status: 'completed', newState: toState };
  }

  // ── applyTransition (skip guards — used after approval granted) ───────────

  /**
   * Apply a state transition directly without evaluating guards.
   * Used by ApprovalService after a pending transition is approved.
   */
  async applyTransition(params: {
    resourceId: string;
    orgId:      string;
    fromState:  string;
    toState:    string;
    actorId:    string;
  }): Promise<void> {
    const { resourceId, orgId, fromState, toState, actorId } = params;

    const { error } = await this.supabase.admin
      .from('lados_resources')
      .update({ state: toState, updated_by: actorId })
      .eq('id', resourceId)
      .eq('org_id', orgId);

    if (error) {
      throw new BadRequestException(`Failed to apply transition: ${error.message}`);
    }

    // Record state change event
    await this.supabase.admin.from('lados_resource_events').insert({
      resource_id: resourceId,
      event_type:  'state_changed',
      from_state:  fromState,
      to_state:    toState,
      actor_id:    actorId,
      metadata:    { via: 'state_engine' },
    });

    this.logger.log(`Resource ${resourceId} transitioned: ${fromState} → ${toState} by ${actorId}`);

    // Publish EventBus event
    void this.eventBus.publish({
      orgId,
      type:       'resource.state_changed',
      sourceType: 'resource',
      sourceId:   resourceId,
      actorId,
      payload:    { fromState, toState },
    });
  }

  // ── Get history ───────────────────────────────────────────────────────────

  async getHistory(resourceId: string, orgId: string): Promise<Record<string, unknown>[]> {
    // Verify the resource belongs to this org
    const { data: res } = await this.supabase.admin
      .from('lados_resources')
      .select('id')
      .eq('id', resourceId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!res) throw new NotFoundException(`Resource ${resourceId} not found`);

    const { data, error } = await this.supabase.admin
      .from('lados_resource_events')
      .select()
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(`Failed to fetch history: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  // ── CRUD for custom state machine definitions ─────────────────────────────

  async createMachine(params: {
    orgId:        string;
    resourceType: string;
    definition:   StateMachineDefinition;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase.admin
      .from('lados_state_machines')
      .insert({
        org_id:        params.orgId,
        resource_type: params.resourceType,
        definition:    params.definition,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(`Failed to create state machine: ${error.message}`);
    return data as Record<string, unknown>;
  }

  async listMachines(orgId: string): Promise<Record<string, unknown>[]> {
    // Return org-specific + system defaults
    const { data, error } = await this.supabase.admin
      .from('lados_state_machines')
      .select()
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq('active', true)
      .order('resource_type');

    if (error) throw new BadRequestException(`Failed to list machines: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  async getMachineForType(resourceType: string, orgId: string): Promise<StateMachineDefinition> {
    return this.loadMachine(resourceType, orgId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getActorRole(userId: string, orgId: string): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle();
    return (data?.['role'] as string | undefined) ?? null;
  }

  private async createApprovalTask(params: {
    orgId:        string;
    resourceId:   string;
    resourceType: string;
    fromState:    string;
    toState:      string;
    actorId:      string;
    title:        string;
    description?: string;
    assigneeRole: string;
    executionId?:  string;
    workflowId?:   string;
    projectId?:    string;
  }): Promise<string> {
    const {
      orgId, resourceId, resourceType, fromState, toState,
      actorId, title, description, assigneeRole,
      executionId, workflowId, projectId,
    } = params;

    const taskData = {
      pendingStateTransition: { resourceId, resourceType, fromState, toState, orgId },
    };

    // Note: approval_tasks has NOT NULL FK constraints on execution_id, workflow_id, project_id.
    // When triggered outside a workflow (REST API), these must be provided or we use a sentinel.
    // For now we only call this guard path from the state.change workflow node, so they are set.
    if (!executionId || !workflowId || !projectId) {
      this.logger.warn(
        `requires_approval guard fired outside workflow context for resource ${resourceId}. ` +
        `approval_task cannot be created without executionId/workflowId/projectId. ` +
        `Treating as blocked.`,
      );
      throw new BadRequestException(
        `Transition "${fromState} → ${toState}" requires approval, but no workflow context is active. ` +
        `Use the state.change workflow node to trigger approval-gated transitions.`,
      );
    }

    const { data: task, error } = await this.supabase.admin
      .from('approval_tasks')
      .insert({
        execution_id:  executionId,
        workflow_id:   workflowId,
        project_id:    projectId,
        node_id:       `state-change-${resourceId}`,
        node_name:     title,
        title,
        description:   description ?? `Review ${resourceType} transition: ${fromState} → ${toState}`,
        data:          taskData,
        status:        'pending',
        assignee_role: assigneeRole,
      })
      .select('id')
      .single();

    if (error || !task) {
      throw new BadRequestException(`Failed to create approval task: ${error?.message}`);
    }

    const approvalTaskId = task['id'] as string;
    this.logger.log(
      `Approval task ${approvalTaskId} created for resource ${resourceId} ` +
      `transition ${fromState} → ${toState}`,
    );

    void this.eventBus.publish({
      orgId,
      type:       'approval.requested',
      sourceType: 'resource',
      sourceId:   resourceId,
      actorId,
      payload:    { approvalTaskId, fromState, toState, resourceType },
    });

    return approvalTaskId;
  }

  private async runActions(
    actions: import('./state-engine.types').ActionDefinition[],
    ctx: { orgId: string; resourceId: string; fromState: string; toState: string; actorId: string },
  ): Promise<void> {
    for (const action of actions) {
      try {
        if (action.type === 'emit_event') {
          await this.eventBus.publish({
            orgId:      ctx.orgId,
            type:       action.eventType,
            sourceType: 'resource',
            sourceId:   ctx.resourceId,
            actorId:    ctx.actorId,
            payload:    { fromState: ctx.fromState, toState: ctx.toState },
          });
        }
        // 'notify' action: future — requires notification context (target userId)
      } catch (err) {
        this.logger.warn(`Action "${action.type}" failed: ${(err as Error).message}`);
      }
    }
  }
}
