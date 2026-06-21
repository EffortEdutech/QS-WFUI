/**
 * @lados/node-sdk — Core types
 * Sprint 5 (S5-001)
 */

// ── Port types ──────────────────────────────────────────────────────────────

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

export interface NodePort {
  id: string;
  label: string;
  type: PortDataType;
  required?: boolean;
  description?: string;
  /** JSON Schema for the data this port accepts/emits */
  schema?: Record<string, unknown>;
}

// ── Configuration schema ────────────────────────────────────────────────────
//
// config_schema  — design-time, set on the canvas, baked into the workflow JSON
//                  Rendered in PropertyPanel under "Configuration"
//                  Available as ctx.config at runtime
//
// input_schema   — runtime, resolved at trigger time
//                  Manual run:    user fills in a modal before execution starts
//                  Automated run: mapped from incoming event/webhook payload
//                  AI nodes:      the dynamic content (document text, file URL)
//                  Available as ctx.inputs at runtime
//
// See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §3.11

export type ConfigFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'file'
  | 'json'
  | 'secret';

/**
 * UI widget hint for PropertyPanel and trigger modal rendering.
 *
 * | Widget           | JSON type     | Use case                                      |
 * | ---------------- | ------------- | --------------------------------------------- |
 * | text             | string        | Short labels, titles, notes                   |
 * | textarea         | string        | Descriptions, AI prompt injection, long text  |
 * | number           | number        | Odometer, quantity, amount                    |
 * | date             | string (ISO)  | Scheduled date, deadline                      |
 * | select           | string (enum) | Fixed options from schema enum                |
 * | toggle           | boolean       | Yes/No flags                                  |
 * | file-upload      | string (url)  | Upload file → returns Supabase Storage URL    |
 * | resource-picker  | string (uuid) | Select an existing resource by type           |
 * | json             | object        | Freeform JSON for advanced config             |
 */
export type UiWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'toggle'
  | 'file-upload'
  | 'resource-picker'
  | 'json';

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  placeholder?: string;
  options?: ConfigFieldOption[];         // for select / multiselect
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  // ── UI widget hints ──────────────────────────────────────────────────────
  /** Controls how PropertyPanel and trigger modal render this field */
  'ui:widget'?: UiWidget;
  /**
   * For resource-picker: the resource type to query.
   * Platform calls GET /resources?type=<resourceType>&organizationId=...
   * to populate the picker dropdown.
   * Example: 'vehicle', 'driver', 'customer', 'job'
   */
  'ui:resourceType'?: string;
  /** For resource-picker: which field to display in the dropdown label */
  'ui:displayField'?: string;
}

export type ConfigSchema = ConfigField[];

// ── UI schema ───────────────────────────────────────────────────────────────

export type NodeCategory =
  | 'core'
  | 'qs'
  | 'procurement'
  | 'document'
  | 'ai'
  | 'integration';

export interface NodeUISchema {
  title: string;
  icon?: string;
  category: NodeCategory;
  color?: string;          // hex, e.g. '#3B82F6'
  description?: string;
  helpUrl?: string;
  /** Groups config fields into sections for the property panel */
  sections?: Array<{
    title: string;
    fieldKeys: string[];
  }>;
}

// ── Node metadata ───────────────────────────────────────────────────────────

export interface NodeMetadata {
  /** Globally unique dotted-path identifier e.g. "qs.read_boq" */
  type: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  /** Pack this node belongs to */
  packId: string;
}

// ── Full node manifest (static definition stored in DB) ────────────────────

export interface NodeManifest {
  metadata: NodeMetadata;

  /**
   * Port-level wiring (node graph connections on the canvas).
   * Used for visual port validation and autocomplete.
   */
  inputs: NodePort[];
  outputs: NodePort[];

  /**
   * Design-time configuration.
   * Set once on the canvas; baked into the workflow JSON definition.
   * Rendered in PropertyPanel under "Configuration".
   * Available as ctx.config at runtime.
   */
  configSchema: ConfigSchema;

  /**
   * Runtime input schema.
   * Resolved at trigger time — NOT baked into the workflow definition.
   *
   * Manual run:    rendered in "Run Workflow" modal; operator fills before execution
   * Automated run: mapped from the incoming event/webhook payload
   * AI nodes:      the changing content (file, message, document text)
   *
   * Available as ctx.inputs at runtime.
   * Supports all ui:widget types including resource-picker.
   */
  inputSchema?: ConfigSchema;

  /**
   * Output schema (mirrors outputs[] but in ConfigField form for UI rendering).
   * Used by the trigger modal to show what this node will produce,
   * and by downstream node pickers to validate port compatibility.
   */
  outputSchema?: ConfigSchema;

  uiSchema: NodeUISchema;
}

// ── Execution context ───────────────────────────────────────────────────────

export interface NodeLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export interface NodeContext {
  executionId: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  /** Resolved configuration values for this node instance */
  config: Record<string, unknown>;
  /** Outputs from upstream nodes keyed by nodeId */
  inputs: Record<string, unknown>;
  logger: NodeLogger;
  /** Runtime variables set at workflow level */
  variables: Record<string, unknown>;
}

// ── Execution result ────────────────────────────────────────────────────────

export type ExecutionStatus = 'success' | 'failure' | 'pending_approval' | 'paused' | 'skipped';

export interface NodeExecuteResult {
  status: ExecutionStatus;
  /** Port outputs keyed by port id */
  outputs: Record<string, unknown>;
  /** Logs captured during execution */
  logs?: string[];
  /** Human-readable summary */
  summary?: string;
  /** If status === 'failure' */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** If status === 'pending_approval' */
  approvalRequest?: {
    title: string;
    description: string;
    assigneeRole?: string;
  };
}

// ── Validation result ───────────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface NodeValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
