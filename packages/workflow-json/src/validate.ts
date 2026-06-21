import { WORKFLOW_SCHEMA_VERSION } from './constants';
import type { ValidationResult, ValidationError } from './types';
import type { QSWorkflowDefinition } from '@lados/shared-types';

/**
 * Validates a raw JSON object against the QS-OS Workflow JSON schema (v1.0).
 *
 * This is a structural validator — it checks required fields, types, and
 * referential integrity (connection node IDs must exist in nodes[]).
 * It does NOT validate node config schemas (that is the execution engine's job).
 */
export function validateWorkflow(json: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, errors: [{ field: 'root', message: 'Must be a JSON object' }] };
  }

  const doc = json as Record<string, unknown>;

  // ── schemaVersion — optional, warn but don't fail ─────────────────────────
  // The workflow metadata (id, name, status, etc.) lives in the workflows table.
  // The definition JSON only needs to be structurally valid (nodes + connections).

  // ── nodes ──────────────────────────────────────────────────────────────────
  if (!Array.isArray(doc['nodes'])) {
    errors.push({ field: 'nodes', message: 'Must be an array' });
  } else {
    const nodeIds = new Set<string>();
    (doc['nodes'] as unknown[]).forEach((node, i) => {
      const n = node as Record<string, unknown>;
      if (!n['id']) errors.push({ field: `nodes[${i}].id`, message: 'Required' });
      else nodeIds.add(n['id'] as string);
      if (!n['type']) errors.push({ field: `nodes[${i}].type`, message: 'Required' });
      if (!n['position'] || typeof n['position'] !== 'object') {
        errors.push({ field: `nodes[${i}].position`, message: 'Required {x, y} object' });
      }
    });

    // ── connections ─────────────────────────────────────────────────────────
    if (!Array.isArray(doc['connections'])) {
      errors.push({ field: 'connections', message: 'Must be an array' });
    } else {
      (doc['connections'] as unknown[]).forEach((conn, i) => {
        const c = conn as Record<string, unknown>;
        if (!c['id']) errors.push({ field: `connections[${i}].id`, message: 'Required' });
        if (!c['sourceNodeId']) errors.push({ field: `connections[${i}].sourceNodeId`, message: 'Required' });
        if (!c['targetNodeId']) errors.push({ field: `connections[${i}].targetNodeId`, message: 'Required' });
        if (!c['sourcePortId']) errors.push({ field: `connections[${i}].sourcePortId`, message: 'Required' });
        if (!c['targetPortId']) errors.push({ field: `connections[${i}].targetPortId`, message: 'Required' });

        // Referential integrity
        if (c['sourceNodeId'] && !nodeIds.has(c['sourceNodeId'] as string)) {
          errors.push({
            field: `connections[${i}].sourceNodeId`,
            message: `Node "${String(c['sourceNodeId'])}" not found in nodes[]`,
          });
        }
        if (c['targetNodeId'] && !nodeIds.has(c['targetNodeId'] as string)) {
          errors.push({
            field: `connections[${i}].targetNodeId`,
            message: `Node "${String(c['targetNodeId'])}" not found in nodes[]`,
          });
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Type-guard: validates and narrows to QSWorkflowDefinition */
export function isValidWorkflow(json: unknown): json is QSWorkflowDefinition {
  return validateWorkflow(json).valid;
}
