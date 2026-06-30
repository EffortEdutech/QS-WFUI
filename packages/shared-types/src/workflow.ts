/**
 * Canonical Workflow JSON types — mirrored from Vol 4 specification.
 * These are the DTO / serializable forms used in API payloads.
 *
 * Full runtime spec lives in @lados/workflow-json.
 */

import type { WorkflowId, NodeInstanceId, NodeTypeId } from './ids';
import type { WorkflowStatus } from './status';

// ─── Root document ───────────────────────────────────────────────────────────

export interface QSWorkflowDefinition {
  /** Must be "1.0" for Sprint 2 */
  schemaVersion: string;
  workflow: WorkflowInfo;
  nodes: WorkflowNodeInstance[];
  connections: WorkflowConnection[];
  variables?: WorkflowVariable[];
  triggers?: WorkflowTrigger[];
  metadata?: WorkflowMetadata;
}

// ─── Workflow info ────────────────────────────────────────────────────────────

export interface WorkflowInfo {
  id: WorkflowId;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  tags?: string[];
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
  createdBy?: string;
}

// ─── Node instance ────────────────────────────────────────────────────────────

/** V3 execution mode for a skill node */
export type SkillMode = 'active' | 'muted' | 'bypassed';

export interface WorkflowNodeInstance {
  /** Unique within this workflow */
  id: NodeInstanceId;
  /** References the registered node type, e.g. "core.start" */
  type: NodeTypeId;
  /** Human label shown on the canvas */
  label?: string;
  /** React Flow canvas position */
  position: { x: number; y: number };
  /** Node-specific config values */
  config?: Record<string, unknown>;
  /**
   * V3 execution mode.
   * - active   (default): executes normally
   * - muted:    skipped; outputs null for every output port
   * - bypassed: skipped; passes first input value through to first output port
   */
  mode?: SkillMode;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export interface WorkflowConnection {
  id: string;
  sourceNodeId: NodeInstanceId;
  sourcePortId: string;
  targetNodeId: NodeInstanceId;
  targetPortId: string;
}

// ─── Variable ─────────────────────────────────────────────────────────────────

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue?: unknown;
  description?: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface WorkflowMetadata {
  /** Pack that this workflow belongs to, e.g. "qs-pack" */
  packId?: string;
  /** Author display name */
  author?: string;
  /** Arbitrary key-value pairs */
  [key: string]: unknown;
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

/**
 * EventTrigger — fires the workflow when a matching event is published to the
 * EventBus. Supports exact match ('resource.state_changed') or wildcard
 * ('resource.*'). Optional filter is matched against event.payload.
 */
export interface EventTrigger {
  type: 'event';
  /** EventBus event type pattern — exact or wildcard e.g. 'resource.*' */
  eventType: string;
  /** Optional payload key/value pairs that must match for the trigger to fire */
  filter?: Record<string, unknown>;
}

/**
 * WebhookTrigger — fires the workflow when an authenticated POST hits
 * POST /webhooks/:orgId/:path.
 * The path must be URL-safe (alphanumeric, hyphens, slashes).
 */
export interface WebhookTrigger {
  type: 'webhook';
  /** Relative path identifying this webhook, e.g. 'payments/notify' */
  path: string;
}

/**
 * ScheduleTrigger — fires the workflow on a cron schedule.
 * The SchedulerService polls every minute and dispatches matching workflows.
 * Phase 10.
 */
export interface ScheduleTrigger {
  type: 'schedule';
  /** Standard 5-part cron expression e.g. "0 8 * * 1-5" */
  cronExpression: string;
  /** IANA timezone identifier. Default: 'Asia/Kuala_Lumpur' */
  timezone?: string;
  /** Human-readable label for the UI */
  label?: string;
}

export type WorkflowTrigger = EventTrigger | WebhookTrigger | ScheduleTrigger;

// ─── Lightweight list DTO (no nodes/connections) ──────────────────────────────

export interface WorkflowSummary {
  id: WorkflowId;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
}
