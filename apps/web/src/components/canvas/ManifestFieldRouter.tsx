'use client';

/**
 * ManifestFieldRouter — Phase 13 (P13-003)
 *
 * Dispatches a single ConfigField to the correct atomic field component.
 * Resolution order:
 *   1. ui:widget hint (explicit, from NodeManifest.uiSchema)
 *   2. field.type (legacy fallback)
 *   3. TextField (ultimate fallback for unknown types)
 */

import {
  TextField,
  SecretField,
  NumberField,
  ToggleField,
  SelectField,
  MultiSelectField,
  DateField,
  TextareaField,
  JsonField,
  FileUploadField,
  LibraryPickerField,
  ResourcePickerField,
  DataPackItemField,
} from './fields';
import type { FieldProps } from './fields';

export default function ManifestFieldRouter(props: FieldProps) {
  const { field } = props;
  const widget = field['ui:widget'] ?? field.ui?.widget;
  const type   = field.type;

  // ── ui:widget takes priority ─────────────────────────────────────────────
  if (widget === 'resource-picker') return <ResourcePickerField {...props} />;
  if (widget === 'data-pack-item')  return <DataPackItemField  {...props} />;
  if (widget === 'file-upload')     return <FileUploadField     {...props} />;
  if (widget === 'json')            return <JsonField            {...props} />;
  if (widget === 'textarea')        return <TextareaField        {...props} />;
  if (widget === 'toggle')          return <ToggleField          {...props} />;
  if (widget === 'number')          return <NumberField          {...props} />;
  if (widget === 'select')          return <SelectField          {...props} />;
  if (widget === 'date')            return <DateField            {...props} />;
  if (widget === 'text')            return <TextField            {...props} />;

  // ── type-based fallback (legacy packs without ui:widget) ─────────────────
  if (type === 'resource')          return <ResourcePickerField  {...props} />;
  if (type === 'data_pack_item')    return <DataPackItemField    {...props} />;
  if (type === 'library-picker')    return <LibraryPickerField   {...props} />;
  if (type === 'file')              return <FileUploadField      {...props} />;
  if (type === 'json')              return <JsonField            {...props} />;
  if (type === 'textarea')          return <TextareaField        {...props} />;
  if (type === 'boolean')           return <ToggleField          {...props} />;
  if (type === 'number')            return <NumberField          {...props} />;
  if (type === 'select')            return <SelectField          {...props} />;
  if (type === 'multiselect')       return <MultiSelectField     {...props} />;
  if (type === 'secret')            return <SecretField          {...props} />;

  // ── string and unknown types ─────────────────────────────────────────────
  return <TextField {...props} />;
}
