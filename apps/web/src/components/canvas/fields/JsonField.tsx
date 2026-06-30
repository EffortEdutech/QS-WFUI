'use client';

import { useState, useEffect } from 'react';
import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function JsonField({ field, value, onChange }: FieldProps) {
  // Maintain a local string for editing; only call onChange when valid JSON
  const toStr = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch { return ''; }
  };

  const [raw, setRaw] = useState<string>(toStr(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync if value changes externally (e.g. node selection change)
  useEffect(() => { setRaw(toStr(value)); setJsonError(null); }, [value]);

  const handleChange = (text: string) => {
    setRaw(text);
    if (text.trim() === '') {
      setJsonError(null);
      onChange(field.key, '');
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onChange(field.key, parsed);
    } catch {
      setJsonError('Invalid JSON');
    }
  };

  return (
    <FieldWrapper field={field}>
      <textarea
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={field.placeholder ?? '{ "key": "value" }'}
        rows={4}
        spellCheck={false}
        data-testid={`field-${field.key}`}
        className={`w-full rounded border px-2 py-1.5 text-xs focus:outline-none font-mono resize-none ${
          jsonError
            ? 'border-red-300 focus:border-red-400 bg-red-50'
            : 'border-gray-200 focus:border-blue-400'
        }`}
      />
      {jsonError && (
        <p className="text-[10px] text-red-500 mt-0.5">⚠ {jsonError}</p>
      )}
    </FieldWrapper>
  );
}
