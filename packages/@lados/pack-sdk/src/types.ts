/**
 * @lados/pack-sdk — Core types (V2)
 *
 * V2 adds: InstallConfigField, StateMachineDecl, ResourceSchemaDecl, EventSchemaDecl
 * V1 types (PackManifest, PackPermission, PackNodeRegistration, etc.) are preserved
 * as a strict superset — existing packs require no changes.
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── Permission ────────────────────────────────────────────────────────────────

export type PackPermissionScope =
  | 'read:files'
  | 'write:files'
  | 'read:database'
  | 'write:database'
  | 'call:ai'
  | 'call:external-api'
  | 'read:secrets'
  | 'send:email'
  | 'send:notification';

export interface PackPermission {
  scope: PackPermissionScope;
  reason: string;
}

// ── Resource view configuration (V1 compat) ───────────────────────────────────

export interface ResourceInlineAction {
  /** Label shown on the action button */
  label: string;
  /** Node type to invoke when the action is triggered */
  node: string;
  /** Action is only visible when the resource is in one of these states */
  visibleInStates: string[];
  icon?: string;
  requiresConfirm?: boolean;
}

export interface ResourceListViewConfig {
  primaryField: string;
  secondaryField?: string;
  badgeField?: string;
  counterField?: string;
  mobileLayout?: 'card' | 'row';
}

export interface ResourceViewConfig {
  list: ResourceListViewConfig;
  inlineActions?: ResourceInlineAction[];
}

export interface PackResourceDefinition {
  type: string;
  displayName: string;
  displayNamePlural?: string;
  icon?: string;
  views?: ResourceViewConfig;
}

// ── V2 — Install config fields ────────────────────────────────────────────────
//
// Shown as a form during pack installation so admins can supply credentials,
// API keys, or preferences that the pack nodes need at runtime.

export type InstallConfigFieldType =
  | 'text'
  | 'secret'
  | 'url'
  | 'email'
  | 'number'
  | 'boolean'
  | 'select';

export interface InstallConfigFieldOption {
  label: string;
  value: string;
}

export interface InstallConfigField {
  /** Config key — stored in pack_config JSONB; accessed via ctx.config at runtime */
  key: string;
  label: string;
  type: InstallConfigFieldType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
  placeholder?: string;
  /** Only for type: 'select' */
  options?: InstallConfigFieldOption[];
  /** Validation regex (applied to string types) */
  pattern?: string;
}

// ── V2 — State machine declarations ──────────────────────────────────────────
//
// Packs declare state machines for their resource types.
// The State Engine reads these to enforce valid transitions.

export interface StateMachineState {
  /** State identifier — must be unique within the machine */
  name: string;
  /** Human-readable label for UI badges */
  label?: string;
  /** True = terminal state (no outgoing transitions allowed) */
  terminal?: boolean;
  /** UI badge color (CSS color or named token) */
  color?: string;
  /** Description for documentation / tooltips */
  description?: string;
}

export interface StateMachineTransition {
  /** Source state(s) this transition applies from */
  from: string | string[];
  /** Target state */
  to: string;
  /** Node type that causes this transition (optional — for documentation/validation) */
  trigger?: string;
  /** Human-readable label */
  label?: string;
  /** If true, transition requires a human approval step before completing */
  requiresApproval?: boolean;
  /** Roles allowed to trigger this transition; empty = any authenticated user */
  allowedRoles?: string[];
}

export interface StateMachineDecl {
  /** Resource type this state machine governs (matches PackResourceDefinition.type) */
  resourceType: string;
  /** Initial state for newly created resources of this type */
  initial: string;
  states: StateMachineState[];
  transitions: StateMachineTransition[];
}

// ── V2 — Resource schema declarations ─────────────────────────────────────────
//
// JSON Schema for each resource type's `data` JSONB column.
// Used by the Resource Engine for validation and by the UI for form generation.

export interface ResourceSchemaDecl {
  /** Resource type (matches PackResourceDefinition.type) */
  resourceType: string;
  displayName?: string;
  description?: string;
  /**
   * JSON Schema (draft-07 compatible) for the resource's `data` JSONB field.
   * The platform validates resource mutations against this schema.
   */
  schema: Record<string, unknown>;
}

// ── V2 — Event schema declarations ────────────────────────────────────────────
//
// Packs declare the event types they emit so the Event Bus can validate payloads
// and the Workflow Engine can subscribe to typed events.

export interface EventSchemaDecl {
  /** Fully qualified event type e.g. "contractor.job.created" */
  eventType: string;
  /** Human-readable description */
  description?: string;
  /** Resource type this event relates to (optional) */
  resourceType?: string;
  /**
   * JSON Schema (draft-07 compatible) for the event payload.
   * The Event Bus validates published events against this schema.
   */
  payloadSchema: Record<string, unknown>;
}

// ── Pack manifest (V2 superset) ───────────────────────────────────────────────

export interface PackManifest {
  /** Unique dotted-path ID e.g. "lados.contractor-pack" */
  id: string;
  version: string;
  displayName: string;
  description?: string;
  author?: string;
  /** Minimum Node SDK version required */
  sdkVersion?: string;
  /** Other pack IDs this pack depends on */
  dependencies?: string[];
  /** Node type IDs this pack provides */
  nodes: string[];
  /** Resource types this pack contributes with view configs */
  resources?: PackResourceDefinition[];
  /** Paths to workflow template JSON files (relative to pack root) */
  workflowTemplates?: string[];
  /** Permissions this pack requires */
  permissions?: PackPermission[];
  /** Pack icon URL or name */
  icon?: string;
  /** Brand colour for UI */
  color?: string;

  // ── V2 additions (optional — existing packs need no changes) ──────────────

  /** Fields shown to admin during pack installation */
  installConfig?: InstallConfigField[];
  /** State machines for each resource type this pack owns */
  stateMachines?: StateMachineDecl[];
  /** JSON schemas for resource data fields */
  resourceSchemas?: ResourceSchemaDecl[];
  /** Event types this pack emits */
  eventSchemas?: EventSchemaDecl[];
}

// ── Node registration ──────────────────────────────────────────────────────────

export interface PackNodeRegistration {
  manifest: NodeManifestV2;
  packId: string;
  enabledByDefault?: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface PackValidationIssue {
  field: string;
  message: string;
}

export interface PackValidationResult {
  valid: boolean;
  issues: PackValidationIssue[];
}
