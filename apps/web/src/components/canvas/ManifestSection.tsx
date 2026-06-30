'use client';

/**
 * ManifestSection — Phase 13 (P13-003)
 *
 * Renders a titled, collapsible group of config fields from NodeManifest.uiSchema.sections[].
 * Used when the node defines field groups; falls back to flat rendering otherwise.
 */

import { useState } from 'react';
import ManifestFieldRouter from './ManifestFieldRouter';
import type { ConfigField } from './fields';

interface ManifestSectionProps {
  title: string;
  fields: ConfigField[];
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  organizationId?: string;
  projectId?: string;
  defaultOpen?: boolean;
}

export default function ManifestSection({
  title,
  fields,
  config,
  onChange,
  organizationId,
  projectId,
  defaultOpen = true,
}: ManifestSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (fields.length === 0) return null;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </span>
        <span className={`text-gray-400 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Section fields */}
      {open && (
        <div className="p-3 space-y-4">
          {fields.map((field) => (
            <ManifestFieldRouter
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={onChange}
              organizationId={organizationId}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
