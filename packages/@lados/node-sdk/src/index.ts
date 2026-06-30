/**
 * @lados/node-sdk V2 — public API
 *
 * Imports NodeManifestV2 and related types from @lados/core.
 * Adds the execution-layer types (NodeContext, BaseNode, etc.)
 * that pack developers need to build nodes.
 *
 * @example
 *   import { BaseNode, NodeContext, NodeExecuteResult } from '@lados/node-sdk';
 *   import type { NodeManifestV2 } from '@lados/node-sdk';
 */

// ── Re-export core types ──────────────────────────────────────────────────────
// Pack developers can import everything from @lados/node-sdk without
// needing a direct @lados/core dependency.
export type {
  // Manifest types
  NodeManifestV2,
  PortDataType,
  PortDefinition,
  ConfigFieldType,
  ConfigField,
  UISchemaField,
  ResourceRequirement,
  EventEmission,
  NodeCategory,
  // Event types
  LadosEvent,
  // Workflow types
  WorkflowNode,
  WorkflowEdge,
  VariableDefinition,
  TriggerConfig,
  ExecutionPolicy,
} from '@lados/core';

// ── Execution types ───────────────────────────────────────────────────────────
export type {
  NodeLogger,
  NodeContext,
  ExecutionStatus,
  NodeError,
  PausePayload,
  NodeExecuteResult,
  NodeExecutor,
  ValidationIssue,
  NodeValidationResult,
} from './types';

// ── Base class ────────────────────────────────────────────────────────────────
export { BaseNode } from './base-node';
