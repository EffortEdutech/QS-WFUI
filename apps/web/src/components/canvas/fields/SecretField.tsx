'use client';

import { useState } from 'react';
import { FieldWrapper } from './FieldWrapper';
import type { FieldProps } from './types';

export default function SecretField({ field, value, onChange }: FieldProps) {
  const [show, setShow] = useState(false);

  return (
    <FieldWrapper field={field}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? '••••••••'}
          data-testid={`field-${field.key}`}
          className="w-full rounded border border-gray-200 px-2 py-1.5 pr-8 text-xs focus:border-blue-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]"
          tabIndex={-1}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </FieldWrapper>
  );
}
