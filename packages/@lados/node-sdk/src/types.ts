/**
 * @lados/node-sdk — Core execution types
 *
 * These types define the contract between the execution engine and node
 * implementations. The engine passes NodeContext in; nodes return NodeExecuteResult.
 *
 * See: docs/Lados/03_LCE_SDK.md §2
 */

// ── Logger ───────────────────────────────────────────────────────────────────

/**
 * Structured logger injected into every NodeContext.
 * All node logging should go through this — never console.log().
 * Log entries are persisted to the `execution_logs` table.
 */
export interface NodeLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  /** Debug-level — only stored when verbose logging is enabled */
  debug?(message: string, data?: unknown): void;
}

// ── Execution context ─────────────────────────────────────────────────────────

/**
 * The execution context passed to every node by the runner.
 *
 * V2 changes from V1:
 *  - `logger` replaces `log` (consistent naming)
 *  - `nodeId` added (the instance ID on the canvas, e.g. "node_abc123")
 *  - `nodeType` added (the registered type, e.g. "fleet.assign_vehicle")
 *  - `variables` added for workflow-level variables
 *  - `services` added for injected platform services (Phase 2+)
 */
export interface NodeContext {
  /** The node instance ID within this workflow (canvas ID) */
  nodeId: string;
  /** The registered node type, e.g. 'fleet.assign_vehicle' */
  nodeType: string;
  /** Active execution run ID (UUID) */
  executionId: string;
  /** Workflow definition ID */
  workflowId: string;
  /** Project this workflow belongs to */
  projectId: string;
  /** Tenant identifier */
  organizationId: string;
  /** User who triggered the run */
  userId: string;
  /**
   * Design-time configuration baked into the workflow definition.
   * Set once on the canvas; available as ctx.config[key].
   */
  config: Record<string, unknown>;
  /**
   * Runtime inputs — resolved at trigger time from the input schema.
   * For manual runs: filled in by the operator in the trigger modal.
   * For event-triggered runs: mapped from the incoming event payload.
   * Available as ctx.inputs[key].
   */
  inputs: Record<string, unknown>;
  /**
   * Outputs from already-completed upstream nodes, keyed by node instance ID.
   * Allows a node to read multiple upstream results.
   * e.g. ctx.upstream['node_abc123']['result']
   */
  upstream: Record<string, Record<string, unknown>>;
  /**
   * Workflow-level variables — read/write shared state (Phase 2+).
   * Available as ctx.variables[name].
   */
  variables: Record<string, unknown>;
  /** Structured logger — all output goes to execution_logs */
  logger: NodeLogger;
  /**
   * Platform services injected by the API host.
   * Available from Phase 2+ — undefined in pure SDK unit tests.
   * Typed as unknown here; consuming nodes cast to their needed service interface.
   */
  services?: Record<string, unknown>;
}

// ── Execution status ──────────────────────────────────────────────────────────

/**
 * The execution status a node can return.
 *
 * - success          : node completed; outputs are ready for downstream nodes
 * - failure          : node failed; workflow halts (or retries per policy)
 * - paused           : node is waiting for human action; runner persists checkpoint
 * - pending_approval : legacy alias for 'paused' — prefer 'paused' in V2
 * - skipped          : node was bypassed; runner continues to next step
 */
export type ExecutionStatus =
  | 'success'
  | 'failure'
  | 'paused'
  | 'pending_approval'
  | 'skipped';

// ── Structured error ──────────────────────────────────────────────────────────

/**
 * Structured error returned by a node on failure.
 * `code` is machine-readable; `message` is human-readable.
 */
export interface NodeError {
  /** Machine-readable error code, e.g. 'RESOURCE_NOT_FOUND', 'AUTH_FAILED' */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional extra context — stack traces, field-level errors, etc. */
  details?: unknown;
}

// ── Pause payload ─────────────────────────────────────────────────────────────

/**
 * Payload for nodes that pause execution and wait for human action.
 *
 * When a node returns `{ status: 'paused', pause: {...} }`, the runner:
 *  1. Persists the checkpoint (all completed node outputs)
 *  2. Creates an approval_task record in the DB
 *  3. Halts the run (status → 'paused')
 *
 * The run resumes when POST /approvals/:taskId/decide is called.
 *
 * V2 renames this from `approvalRequest` to `pause` for generality —
 * not all pauses are approval requests (e.g. a wait-for-event pause).
 */
export interface PausePayload {
  /** Short title shown in the approval inbox */
  title: string;
  /** Full description of what the approver needs to do */
  description: string;
  /**
   * Role that should see this approval task.
   * @example 'admin', 'approver', 'manager'
   */
  assigneeRole?: string;
  /**
   * Deadline for this approval in ISO-8601.
   * If exceeded, the run is automatically failed (Phase 2+).
   */
  deadline?: string;
  /**
   * Structured data the approver needs to make their decision.
   * Shown in the approval detail view.
   */
  context?: Record<string, unknown>;
}

// ── Execution result ──────────────────────────────────────────────────────────

/**
 * What every node executor must return.
 *
 * V2 changes from V1:
 *  - `pause` replaces `approvalRequest` (more general naming)
 *  - `error` is now `NodeError` (typed) instead of inline interface
 */
export interface NodeExecuteResult {
  status: ExecutionStatus;
  /**
   * Output values keyed by port ID.
   * Used by the runner to satisfy downstream node inputs.
   * Must be present even on failure (use empty object `{}`).
   */
  outputs: Record<string, unknown>;
  /** Log lines captured during execution (appended to execution_logs) */
  logs?: string[];
  /** Human-readable summary shown in the execution timeline UI */
  summary?: string;
  /** Structured error — required when status === 'failure' */
  error?: NodeError;
  /**
   * Pause payload — required when status === 'paused' or 'pending_approval'.
   * The runner uses this to create an approval_task record.
   *
   * Also accepted as `approvalRequest` for V1 backwards compatibility.
   */
  pause?: PausePayload;
  /** @deprecated Use `pause` instead */
  approvalRequest?: PausePayload;
}

// ── Node executor function type ────────────────────────────────────────────────

/**
 * The function signature every node executor must match.
 * The runner resolves a node type string → NodeExecutor, then calls it.
 */
export type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

// ── Validation ─────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  /** Config key or input field that has the issue */
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface NodeValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
