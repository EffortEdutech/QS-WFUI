/**
 * @lados/node-sdk
 *
 * Base classes, interfaces, and types for building QS-OS nodes.
 * Sprint 5 (S5-001) — full implementation.
 */

export const NODE_SDK_VERSION = '1.0.0' as const;

// Types
export type {
  PortDataType,
  NodePort,
  ConfigFieldType,
  ConfigFieldOption,
  ConfigField,
  ConfigSchema,
  NodeCategory,
  NodeUISchema,
  NodeMetadata,
  NodeManifest,
  NodeLogger,
  NodeContext,
  ExecutionStatus,
  NodeExecuteResult,
  ValidationIssue,
  NodeValidationResult,
} from './types';

// Base class
export { BaseNode } from './base-node';
