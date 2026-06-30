'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function ToggleField({ field, value, onChange }: FieldProps) {
  const checked = Boolean(value);

  return (
    <FieldWrapper field={field}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(field.key, !checked)}
        data-testid={`field-${field.key}`}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="ml-2 text-xs text-gray-600 align-middle">
        {checked ? 'Enabled' : 'Disabled'}
      </span>
    </FieldWrapper>
  );
}
