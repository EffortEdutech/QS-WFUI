'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function DateField({ field, value, onChange }: FieldProps) {
  // Store as ISO date string (YYYY-MM-DD)
  const dateStr = (value as string) ?? '';

  return (
    <FieldWrapper field={field}>
      <input
        type="date"
        value={dateStr}
        onChange={(e) => onChange(field.key, e.target.value)}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
      />
    </FieldWrapper>
  );
}
