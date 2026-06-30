'use client';

import type { ReactNode } from 'react';
import type { ConfigField } from './types';

/**
 * Renders the label, required marker, and description above any field widget.
 * Each atomic field component wraps its input in this to stay DRY.
 */
export function FieldWrapper({
  field,
  children,
}: {
  field: ConfigField;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[11px] text-gray-400 mb-1 leading-snug">{field.description}</p>
      )}
      {children}
    </div>
  );
}
