'use client';
/**
 * ResourceStateBar — Phase 3D
 *
 * Displays the current resource state as a colored badge.
 * Fetches the state machine definition once to get state colors/labels.
 *
 * Note: GET /state-machines/:type returns a bare StateMachineDefinition (no
 * ApiResponse wrapper), so we cast accordingly after apiClient.get().
 */

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StateDefinition {
  label:    string;
  terminal: boolean;
  color?:   string;
}

interface StateMachineDefinition {
  initial:     string;
  states:      Record<string, StateDefinition>;
  transitions: unknown[];
}

export interface ResourceStateBarProps {
  resourceType: string;
  currentState: string;
  orgId:        string;
  className?:   string;
}

// ── Color map ─────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-green-100  text-green-800  ring-green-600/20',
  blue:   'bg-blue-100   text-blue-800   ring-blue-600/20',
  yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  red:    'bg-red-100    text-red-800    ring-red-600/20',
  orange: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  gray:   'bg-gray-100   text-gray-800   ring-gray-600/20',
  purple: 'bg-purple-100 text-purple-800 ring-purple-600/20',
  indigo: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
  teal:   'bg-teal-100   text-teal-800   ring-teal-600/20',
};

const DEFAULT_CLASSES = 'bg-gray-100 text-gray-800 ring-gray-600/20';

function badgeClasses(color?: string): string {
  return (color && COLOR_CLASSES[color]) ?? DEFAULT_CLASSES;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResourceStateBar({
  resourceType,
  currentState,
  orgId,
  className = '',
}: ResourceStateBarProps) {
  const [machine, setMachine] = useState<StateMachineDefinition | null>(null);

  useEffect(() => {
    if (!resourceType || !orgId) return;

    // The controller returns the machine definition as a bare object (not { success, data }).
    // apiClient.get() still handles auth; we cast the runtime value to the actual shape.
    void apiClient
      .get(`/state-machines/${encodeURIComponent(resourceType)}?organizationId=${orgId}`)
      .then((raw) => {
        const obj = raw as unknown;
        if (obj && typeof obj === 'object' && 'states' in (obj as object)) {
          setMachine(obj as StateMachineDefinition);
        }
      })
      .catch(() => {
        // Fail silently — badge falls back to raw state string
      });
  }, [resourceType, orgId]);

  const stateDef = machine?.states[currentState];
  const label    = stateDef?.label ?? currentState.replace(/_/g, ' ');
  const color    = stateDef?.color;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeClasses(color)} ${className}`}
    >
      {label}
    </span>
  );
}
