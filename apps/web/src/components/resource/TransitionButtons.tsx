'use client';
/**
 * TransitionButtons — Phase 3D
 *
 * Renders available state transitions as action buttons.
 * Integrates with useResourceState.transition().
 *
 * Features:
 *   - Per-button loading spinner (only the clicked button shows loading)
 *   - All buttons disabled while any transition is in flight
 *   - Renders nothing when no transitions are available (terminal state / empty machine)
 *
 * Usage:
 *   <TransitionButtons transitions={transitions} onTransition={transition} />
 */

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransitionDef {
  id:      string;
  from:    string;
  to:      string;
  label:   string;
  guards:  unknown[];
  actions: unknown[];
}

export interface TransitionResult {
  status:          string;
  newState?:       string;
  approvalTaskId?: string;
  pendingToState?: string;
  reason?:         string;
}

export interface TransitionButtonsProps {
  transitions:  TransitionDef[];
  onTransition: (toState: string) => Promise<TransitionResult>;
  disabled?:    boolean;
  /** Called after a successful or approval-required transition */
  onComplete?:  (result: TransitionResult) => void;
  /** Called on error */
  onError?:     (err: Error) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransitionButtons({
  transitions,
  onTransition,
  disabled   = false,
  onComplete,
  onError,
}: TransitionButtonsProps) {
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  if (!transitions.length) return null;

  async function handleClick(toState: string): Promise<void> {
    if (pendingTo !== null) return;  // prevent double-fire
    setPendingTo(toState);
    try {
      const result = await onTransition(toState);
      onComplete?.(result);
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setPendingTo(null);
    }
  }

  const isBusy = pendingTo !== null || disabled;

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => {
        const isThisLoading = pendingTo === t.to;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => void handleClick(t.to)}
            disabled={isBusy}
            aria-label={`Transition to ${t.label}`}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5',
              'text-sm font-medium ring-1 ring-inset transition-colors',
              isThisLoading
                ? 'cursor-wait bg-gray-50 text-gray-400 ring-gray-200'
                : isBusy
                  ? 'cursor-not-allowed bg-white text-gray-300 ring-gray-200'
                  : 'bg-white text-gray-700 ring-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-300 active:bg-blue-100',
            ].join(' ')}
          >
            {isThisLoading && (
              <svg
                className="h-3.5 w-3.5 animate-spin text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
