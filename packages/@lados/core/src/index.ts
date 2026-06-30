/**
 * @lados/core — public API
 *
 * Shared types for the Lados Core Engine.
 * Import from this package in all @lados/* packages and apps.
 *
 * @example
 *   import type { LadosEvent, NodeManifestV2, WorkflowNode } from '@lados/core';
 */

// ── Event Bus ────────────────────────────────────────────────────────────────
export type { LadosEvent, EventSubscription } from './events';

// ── Workflow graph ────────────────────────────────────────────────────────────
export type {
  WorkflowNode,
  WorkflowEdge,
  VariableType,
  VariableDefinition,
  TriggerType,
  TriggerConfig,
  ExecutionPolicy,
} from './workflow';

// ── Node Manifest V2 ──────────────────────────────────────────────────────────
export type {
  PortDataType,
  PortDefinition,
  ConfigFieldType,
  UISchemaField,
  ConfigField,
  ResourceRequirement,
  EventEmission,
  NodeCategory,
  NodeManifestV2,
} from './manifest';
