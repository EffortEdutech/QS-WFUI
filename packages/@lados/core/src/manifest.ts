/**
 * @lados/core — Node Manifest V2 types
 *
 * NodeManifestV2 is the upgraded node declaration contract.
 * It extends V1 (NodeManifest in @lados/node-sdk) with:
 *   - ResourceRequirement[]  — declares which resource types the node accesses
 *   - EventEmission[]        — declares which events the node can emit
 *   - UISchemaField[]        — richer UI hints for PropertyPanel rendering
 *   - inputSchema / outputSchema — separate runtime-input and output schemas
 *
 * Phase 1F upgrades all existing nodes to NodeManifestV2.
 * Phase 1C rewrites @lados/node-sdk to import these types from @lados/core.
 *
 * See: docs/Lados/03_LCE_SDK.md §2
 */

// ── Port definition ─────────────────────────────────────────────────────────

/** Data types that can flow through a node port */
export type PortDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file'
  | 'json'
  | 'boq'
  | 'any';

/**
 * V2 port definition.
 *
 * Renamed from `NodePort` (V1) for clarity.
 * Uses `name` and `dataType` (matching the SDK doc) instead of
 * V1's `label` and `type`. Phase 1C will migrate node-sdk accordingly.
 */
export interface PortDefinition {
  /** Unique port identifier within this node, e.g. 'jobId', 'result' */
  id: string;
  /** Human-readable port name shown on the canvas */
  name: string;
  dataType: PortDataType;
  required?: boolean;
  description?: string;
  /**
   * JSON Schema fragment describing the port value structure.
   * Used for design-time validation and autocomplete in the canvas.
   */
  schema?: Record<string, unknown>;
}

// ── Config field ────────────────────────────────────────────────────────────

/** Supported config field types — maps to PropertyPanel input widgets */
export type ConfigFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'file'
  | 'json'
  | 'secret'
  | 'resource';

/**
 * UI schema field — rendering hints for PropertyPanel and trigger modal.
 *
 * Separated from ConfigField so the UI layer can be swapped independently
 * of the data contract. Phase 4 (Design Studio) uses these hints to render
 * richer form controls.
 */
export interface UISchemaField {
  /** Config field key this hint applies to */
  key: string;
  /**
   * Widget type override.
   * | Widget           | Use case                                      |
   * |------------------|-----------------------------------------------|
   * | text             | Short labels, titles                          |
   * | textarea         | Descriptions, AI prompt text, long content    |
   * | number           | Quantities, amounts, thresholds               |
   * | date             | Scheduled dates, deadlines                    |
   * | select           | Fixed enum options                            |
   * | toggle           | Yes/No boolean flags                          |
   * | file-upload      | Upload → returns Supabase Storage URL         |
   * | resource-picker  | Select an existing resource by type           |
   * | json             | Freeform JSON for advanced config             |
   * | secret           | Password-masked input, stored encrypted       |
   */
  widget?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'toggle'
    | 'file-upload'
    | 'resource-picker'
    | 'json'
    | 'secret';
  /**
   * For 'resource-picker': the resource type to query.
   * Platform calls GET /resources?type=<resourceType>&organizationId=...
   * @example 'Vehicle', 'Driver', 'Customer', 'Job'
   */
  resourceType?: string;
  /** For 'resource-picker': field to display in the dropdown label */
  displayField?: string;
  /** Placeholder text shown in the input when empty */
  placeholder?: string;
  /** Display order within the PropertyPanel form (lower = earlier) */
  order?: number;
  /** Hide this field from the PropertyPanel (still validated at runtime) */
  hidden?: boolean;
  /** Group label for collapsible sections in the PropertyPanel */
  group?: string;
}

/**
 * V2 config field definition.
 *
 * Config fields drive the PropertyPanel form in the canvas UI.
 * Values are set once at design time, baked into the workflow JSON,
 * and available as ctx.config at runtime.
 *
 * Note: V1 used `label` for the human name and embedded UI hints directly
 * on the field (e.g. 'ui:widget'). V2 separates the data contract from
 * UI hints via the optional `ui` sub-object.
 */
export interface ConfigField {
  /** Unique key within this node's config schema — used as ctx.config[key] */
  key: string;
  /** Human-readable label shown in PropertyPanel */
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  /** For 'select' and 'multiselect' types */
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  /** Optional UI rendering hints */
  ui?: UISchemaField;
}

// ── Resource requirement ────────────────────────────────────────────────────

/**
 * Declares that a node requires access to a specific resource type.
 *
 * Used by the Security Engine (Phase 3) to enforce permissions and
 * by the Marketplace (Phase 8) to show resource dependencies in the UI.
 */
export interface ResourceRequirement {
  /**
   * Resource type this node accesses, e.g. 'Vehicle', 'Driver', 'Job'.
   * Must match a resource type registered by an installed pack.
   */
  type: string;
  /** Level of access required */
  access: 'read' | 'write' | 'create' | 'delete';
  /** Human description of why this access is needed */
  description?: string;
}

// ── Event emission ──────────────────────────────────────────────────────────

/**
 * Declares an event type that a node can emit during execution.
 *
 * Used at design time to:
 * - Validate that receiving nodes subscribe to the correct event types
 * - Display event outputs in the canvas node card (Phase 4)
 * - Generate documentation in the Marketplace (Phase 8)
 *
 * At runtime, nodes emit events via ctx.events.emit(type, payload).
 */
export interface EventEmission {
  /**
   * Event type this node emits, e.g. 'VehicleAssigned'.
   * Convention: PascalCase, domain-namespaced if needed ('fleet.VehicleAssigned').
   */
  eventType: string;
  /** Human description of when this event fires */
  description?: string;
  /**
   * JSON Schema fragment describing the event payload.
   * Used for design-time validation of downstream event-triggered nodes.
   */
  payloadSchema?: Record<string, unknown>;
}

// ── Node category ───────────────────────────────────────────────────────────

export type NodeCategory =
  | 'core'
  | 'resource'
  | 'event'
  | 'document'
  | 'ai'
  | 'procurement'
  | 'qs'
  | 'fleet'
  | 'finance'
  | 'integration'
  | 'notification'
  | 'scheduler'
  | 'utility'
  | 'construction';   // Phase 7

// ── Node Manifest V2 ────────────────────────────────────────────────────────

/**
 * NodeManifestV2 — the upgraded static declaration for every Lados node.
 *
 * Every node implementation must export a `manifest: NodeManifestV2` object.
 * The Node Registry API reads this to populate `registered_nodes` in the DB.
 *
 * Changes from V1 (NodeManifest in @lados/node-sdk):
 *   + `version` field (was missing — required for registry diffing)
 *   + `packId` promoted to top-level (was nested in metadata)
 *   + `inputs`/`outputs` use PortDefinition instead of NodePort
 *   + `config` uses V2 ConfigField (with `ui` sub-object)
 *   + `resourceRequirements` — declares resource access (new)
 *   + `events` is now EventEmission[] instead of string[] (richer)
 *   + `inputSchema`/`outputSchema` — explicit runtime schemas (optional)
 *
 * See: docs/Lados/03_LCE_SDK.md §2.2
 */
export interface NodeManifestV2 {
  // ── Identity ──────────────────────────────────────────────────────────────
  /**
   * Globally unique dot-namespaced node type identifier.
   * @example 'fleet.assign_vehicle', 'core.human_approval', 'qs.read_boq'
   */
  type: string;
  /** Human-readable node name shown in the NodePalette */
  name: string;
  /** Semver string for this manifest version, e.g. '1.0.0' */
  version: string;
  description: string;
  category: NodeCategory;
  /** Pack this node belongs to, e.g. 'lados.fleet' */
  packId: string;
  tags?: string[];
  author?: string;

  // ── Graph ports ───────────────────────────────────────────────────────────
  /** Ports that receive data from upstream nodes (graph wiring) */
  inputs: PortDefinition[];
  /** Ports that emit data to downstream nodes (graph wiring) */
  outputs: PortDefinition[];

  // ── Config schema ─────────────────────────────────────────────────────────
  /**
   * Design-time configuration fields.
   * Set once on the canvas; baked into the workflow JSON definition.
   * Rendered in PropertyPanel under "Configuration".
   * Available as ctx.config at runtime.
   */
  config: ConfigField[];

  /**
   * Runtime input schema.
   * Resolved at trigger time — NOT baked into the workflow definition.
   *
   * Manual run:    rendered in "Run Workflow" modal; operator fills before run
   * Automated run: mapped from the incoming event/webhook payload
   * AI nodes:      the changing content (file URL, message text)
   *
   * Available as ctx.inputs at runtime.
   */
  inputSchema?: ConfigField[];

  /**
   * Output schema — mirrors outputs[] but in ConfigField form.
   * Used by the trigger modal to show what this node produces,
   * and by downstream node pickers to validate port compatibility.
   */
  outputSchema?: ConfigField[];

  // ── V2 additions ──────────────────────────────────────────────────────────
  /**
   * Resource types this node reads or writes.
   * Used by the Security Engine to enforce permissions (Phase 3).
   * If empty or omitted, node accesses no resources directly.
   */
  resourceRequirements?: ResourceRequirement[];

  /**
   * Events this node may emit during execution.
   * More descriptive than V1's string[] — includes payload schema.
   * Used for design-time validation and canvas documentation.
   */
  events?: EventEmission[];
}
