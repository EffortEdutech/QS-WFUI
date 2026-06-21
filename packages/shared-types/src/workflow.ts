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
