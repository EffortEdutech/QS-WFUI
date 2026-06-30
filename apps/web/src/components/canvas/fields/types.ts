/**
 * Shared types for manifest-driven field components.
 * Phase 13 (P13-001)
 *
 * ConfigField extends the node-sdk definition to include legacy field types
 * used in existing packs ('library-picker', 'resource') alongside the
 * official ui:widget hints from NodeManifest.uiSchema.
 */

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
  | 'library-picker'   // legacy: same as ui:widget='resource-picker' for library files
  | 'resource';        // legacy: same as ui:widget='resource-picker'

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
  /** ui:widget overrides the default rendering derived from `type` */
  'ui:widget'?: UiWidget;
  /** For resource-picker: which resource type to query */
  'ui:resourceType'?: string;
  /** Legacy alias for ui:resourceType */
  resourceType?: string;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  placeholder?: string;
  options?: ConfigFieldOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/** Props shared by all atomic field components */
export interface FieldProps {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  organizationId?: string;
  projectId?: string;
}

/** Helper: label + required marker + description wrapper rendered by each field */
export function fieldLabel(field: ConfigField): { label: string; required: boolean; description?: string } {
  return { label: field.label, required: field.required ?? false, description: field.description };
}
