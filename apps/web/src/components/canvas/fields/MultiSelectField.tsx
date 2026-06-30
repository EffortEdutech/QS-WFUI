'use client';

import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function MultiSelectField({ field, value, onChange }: FieldProps) {
  // value is stored as string[] (array of selected option values)
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];

  const toggle = (optValue: string) => {
    const next = selected.includes(optValue)
      ? selected.filter((v) => v !== optValue)
      : [...selected, optValue];
    onChange(field.key, next);
  };

  return (
    <FieldWrapper field={field}>
      {(!field.options || field.options.length === 0) ? (
        <p className="text-[10px] text-amber-500">No options defined for this field</p>
      ) : (
        <div className="space-y-1" data-testid={`field-${field.key}`}>
          {field.options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(opt.value)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-700">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((v) => {
            const label = field.options?.find((o) => o.value === v)?.label ?? v;
            return (
              <span key={v} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 text-[10px] font-medium">
                {label}
                <button type="button" onClick={() => toggle(v)} className="ml-0.5 text-blue-400 hover:text-blue-700">✕</button>
              </span>
            );
          })}
        </div>
      )}
    </FieldWrapper>
  );
}
