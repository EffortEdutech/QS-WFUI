/**
 * State Engine — shared types (Phase 5)
 *
 * These are the TypeScript representations of the JSON stored in
 * lados_state_machines.definition.
 */

// ── State machine definition ──────────────────────────────────────────────────

export interface StateDefinition {
  label:     string;
  terminal:  boolean;
  color?:    string;
}

export type GuardDefinition =
  | { type: 'requires_role';     role: string }
  | { type: 'requires_approval'; title: string; description?: string; assigneeRole?: string };

export type ActionDefinition =
  | { type: 'emit_event'; eventType: string }
  | { type: 'notify';     title: string; message?: string };

export interface TransitionDefinition {
  id:      string;
  from:    string;
  to:      string;
  label:   string;
  guards:  GuardDefinition[];
  actions: ActionDefinition[];
}

export interface StateMachineDefinition {
  initial:     string;
  states:      Record<string, StateDefinition>;
  transitions: TransitionDefinition[];
}

// ── Transition result ─────────────────────────────────────────────────────────

export type TransitionResult =
  | { status: 'completed';          newState: string }
  | { status: 'approval_required';  approvalTaskId: string; pendingToState: string }
  | { status: 'blocked';            reason: string };
