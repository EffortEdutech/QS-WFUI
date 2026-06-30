/**
 * @lados/core — Workflow graph types
 *
 * These are the V2 canonical types for a workflow definition document.
 * They define the runtime shape consumed by @lados/execution-engine.
 *
 * Note: WorkflowNodeInstance (canvas DTO) lives in @lados/shared-types.
 *       WorkflowNode here is the lean runtime form used by the engine.
 *
 * See: docs/Lados/02_LCE_Runtime.md §5.1
 */

// ── Workflow graph node ─────────────────────────────────────────────────────

/**
 * A node in the workflow execution graph.
 *
 * This is the runtime representation — leaner than the canvas DTO
 * (WorkflowNodeInstance in @lados/shared-types) which carries position data.
 */
export interface WorkflowNode {
  /** Unique instance ID within this workflow */
  id: string;
  /** Registered node type, e.g. 'fleet.assign_vehicle' */
  type: string;
  /** Human label shown on the canvas */
  label: string;
  /**
   * Design-time configuration values baked into the workflow definition.
   * Available as ctx.config at runtime.
   */
  config: Record<string, unknown>;
  /**
   * V2 execution mode.
   * - active   (default): executes normally
   * - muted:    skipped; outputs null for every output port
   * - bypassed: skipped; passes first input value to first output port
   */
  mode?: 'active' | 'muted' | 'bypassed';
}

// ── Workflow edge ───────────────────────────────────────────────────────────

/**
 * A directed connection between two ports in the workflow graph.
 */
export interface WorkflowEdge {
  /** Unique edge ID */
  id: string;
  /** Source node instance ID */
  sourceNodeId: string;
  /** Source port ID on the source node */
  sourcePortId: string;
  /** Target node instance ID */
  targetNodeId: string;
  /** Target port ID on the target node */
  targetPortId: string;
  /**
   * Optional label shown on the canvas for conditional branches.
   * e.g. 'true' / 'false' for workflow.condition output ports.
   */
  label?: string;
}

// ── Variable definition ─────────────────────────────────────────────────────

/** Primitive types supported for workflow variables */
export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * A workflow-level variable — available to every node via ctx.variables.
 *
 * Variables are set at trigger time (manual run modal / event payload mapping)
 * and are immutable during execution in V1. V2 introduces writable variables
 * via the core.set_variable node.
 */
export interface VariableDefinition {
  /** Variable name — must be a valid JS identifier */
  name: string;
  type: VariableType;
  /** Default value used when not supplied at trigger time */
  defaultValue?: unknown;
  /** Human description shown in the trigger modal */
  description?: string;
  /**
   * Variable scope:
   * - 'workflow' (default): persists for the entire run
   * - 'run': reset between parallel branches (Phase 6)
   */
  scope?: 'workflow' | 'run';
  /** Whether the user must supply a value when running manually */
  required?: boolean;
}

// ── Trigger config ──────────────────────────────────────────────────────────

/** All trigger types supported by the Lados Workflow Engine */
export type TriggerType = 'manual' | 'cron' | 'event' | 'webhook' | 'api';

/**
 * Trigger configuration for a workflow.
 *
 * Embedded in the workflow definition under `trigger`.
 * The engine reads this on publish to set up the correct listener.
 *
 * See: docs/Lados/02_LCE_Runtime.md §5.1, Phase 5 (Event-Driven Triggers)
 */
export interface TriggerConfig {
  type: TriggerType;
  /**
   * For 'cron' triggers — standard cron expression.
   * @example '0 9 * * 1'  — every Monday at 9 AM
   */
  cron?: string;
  /**
   * For 'event' triggers — the event type to listen for.
   * Supports exact match or wildcard suffix: 'fleet.*'
   */
  eventType?: string;
  /**
   * For 'webhook' triggers — webhook slug or UUID.
   * The platform generates a URL: /webhooks/:webhookId
   */
  webhookId?: string;
  /**
   * Input schema for 'manual' and 'api' triggers.
   * Rendered in the Run Workflow modal for manual runs.
   * For API triggers, documents the expected request body.
   */
  inputSchema?: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    defaultValue?: unknown;
    description?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
  /** Human-readable description of when/why this trigger fires */
  description?: string;
}

// ── Execution policy ────────────────────────────────────────────────────────

/**
 * Execution policy for a workflow — controls concurrency, timeouts, and retry.
 *
 * Embedded in the workflow definition under `executionPolicy`.
 * Enforced by the runner at the start of each run.
 *
 * See: docs/Lados/02_LCE_Runtime.md, Phase 6 (Parallel Execution)
 */
export interface ExecutionPolicy {
  /**
   * Maximum number of concurrent runs for this workflow.
   * Defaults to unlimited (undefined).
   */
  maxConcurrent?: number;
  /**
   * What to do when maxConcurrent is exceeded.
   * - 'queue'         (default): new run waits until a slot is free
   * - 'reject':       new run is rejected with an error
   * - 'cancel_oldest': oldest running instance is cancelled to make room
   */
  onConcurrencyExceeded?: 'queue' | 'reject' | 'cancel_oldest';
  /**
   * Maximum wall-clock time (seconds) a single run may take.
   * Defaults to 3600 (1 hour). Set to 0 for no limit.
   */
  timeoutSeconds?: number;
  /** Auto-retry policy on node failure */
  retryPolicy?: {
    /** Max total attempts (including the first). Minimum: 1. */
    maxAttempts: number;
    /** Seconds to wait between attempts (exponential backoff if > 0) */
    backoffSeconds: number;
    /**
     * If set, only retry when the error code matches one in this list.
     * If omitted, retry on any failure.
     */
    retryOn?: string[];
  };
  /**
   * Whether to allow parallel branch execution (Phase 6).
   * Defaults to false — all nodes execute sequentially.
   */
  allowParallelBranches?: boolean;
}
