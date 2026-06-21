import type { QSWorkflowDefinition } from '@lados/shared-types';
import { validateWorkflow } from './validate';

/**
 * Parse a raw JSON string or object into a typed QSWorkflowDefinition.
 * Throws if the input is invalid.
 */
export function parseWorkflow(raw: string | unknown): QSWorkflowDefinition {
  const json = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  const result = validateWorkflow(json);

  if (!result.valid) {
    const summary = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Invalid Workflow JSON — ${summary}`);
  }

  return json as QSWorkflowDefinition;
}

/**
 * Serialize a QSWorkflowDefinition to a pretty-printed JSON string.
 * Stamps updatedAt to now() before serializing.
 */
export function serializeWorkflow(def: QSWorkflowDefinition): string {
  const stamped: QSWorkflowDefinition = {
    ...def,
    workflow: {
      ...def.workflow,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(stamped, null, 2);
}
