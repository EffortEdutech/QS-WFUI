'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function TextareaField({ field, value, onChange }: FieldProps) {
  return (
    <FieldWrapper field={field}>
      <textarea
        value={(value as string) ?? ''}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none resize-none"
      />
    </FieldWrapper>
  );
}
