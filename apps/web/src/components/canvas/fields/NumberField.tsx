'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function NumberField({ field, value, onChange }: FieldProps) {
  const min = field.validation?.min;
  const max = field.validation?.max;

  return (
    <FieldWrapper field={field}>
      <input
        type="number"
        value={(value as number) ?? ''}
        onChange={(e) => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={field.placeholder}
        min={min}
        max={max}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
      />
      {(min !== undefined || max !== undefined) && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          {min !== undefined && max !== undefined && `${min} – ${max}`}
          {min !== undefined && max === undefined && `Min: ${min}`}
          {min === undefined && max !== undefined && `Max: ${max}`}
        </p>
      )}
    </FieldWrapper>
  );
}
