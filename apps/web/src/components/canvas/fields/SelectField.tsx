'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function SelectField({ field, value, onChange }: FieldProps) {
  return (
    <FieldWrapper field={field}>
      <select
        value={(value as string) ?? ''}
        onChange={(e) => onChange(field.key, e.target.value)}
        data-testid={`field-${field.key}`}
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white"
      >
        <option value="">— Select —</option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(!field.options || field.options.length === 0) && (
        <p className="text-[10px] text-amber-500 mt-0.5">No options defined for this field</p>
      )}
    </FieldWrapper>
  );
}
