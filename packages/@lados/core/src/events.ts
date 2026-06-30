/**
 * @lados/core — Event Bus types
 *
 * LadosEvent is the canonical event envelope for every action recorded
 * in the event bus. All packs emit and subscribe to this shape.
 *
 * See: docs/Lados/08_LCE_Event_Bus.md
 */

// ── Event envelope ──────────────────────────────────────────────────────────

/**
 * The canonical event envelope for every event in the Lados Event Bus.
 *
 * @example
 *   const event: LadosEvent = {
 *     id: 'uuid',
 *     type: 'VehicleAssigned',
 *     packId: 'lados.fleet',
 *     organizationId: 'org-uuid',
 *     userId: 'user-uuid',
 *     timestamp: new Date().toISOString(),
 *     payload: { jobId: '...', vehicleId: '...' },
 *   };
 */
export interface LadosEvent {
  /** UUID — unique event identifier */
  id: string;
  /** Dot-namespaced event type, e.g. 'fleet.VehicleAssigned' */
  type: string;
  /** Pack that declared/emitted this event, e.g. 'lados.fleet' */
  packId: string;
  /** Tenant identifier */
  organizationId: string;
  /** Project scope (optional — some events are org-level) */
  projectId?: string;
  /** Workflow that produced the event, if any */
  workflowId?: string;
  /** Execution run that produced the event, if any */
  executionId?: string;
  /** User who triggered the action */
  userId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Domain-specific event payload */
  payload: Record<string, unknown>;
  /** Optional system-level metadata (correlation IDs, source IP, etc.) */
  meta?: Record<string, unknown>;
}

// ── Event subscription ──────────────────────────────────────────────────────

/**
 * Describes an event type that a node or pack can listen for.
 * Used in TriggerConfig (type: 'event') and pack manifests.
 */
export interface EventSubscription {
  /** Event type pattern — exact string or '*' wildcard suffix, e.g. 'fleet.*' */
  eventType: string;
  /** Human description of why this subscription exists */
  description?: string;
  /**
   * JSON Schema fragment describing the payload structure this handler expects.
   * Used for design-time validation in the canvas.
   */
  payloadSchema?: Record<string, unknown>;
}
