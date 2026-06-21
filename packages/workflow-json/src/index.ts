/**
 * @lados/workflow-json
 *
 * Workflow JSON schema validation, parsing, serialization, and building.
 * Schema version: 1.0
 * File extension: .qsworkflow.json
 */

export { WORKFLOW_SCHEMA_VERSION, WORKFLOW_FILE_EXTENSION, WORKFLOW_MIME_TYPE } from './constants';
export { validateWorkflow, isValidWorkflow } from './validate';
export { parseWorkflow, serializeWorkflow } from './serialization';
export { WorkflowBuilder } from './builder';
export type { ValidationResult, ValidationError } from './types';
