'use client';
/**
 * useResourceState — Phase 3D
 *
 * Fetches a resource + its available state-machine transitions, and subscribes
 * to Supabase Realtime so the state badge and transition buttons update live
 * whenever the API applies a transition (from any source — UI, workflow, etc.).
 *
 * Usage:
 *   const { resource, transitions, loading, error, transition, refresh } =
 *     useResourceState(resourceId, resourceType, orgId);
 *
 * API shapes expected:
 *   GET /resources/:id                         → { success, data: ResourceRecord }
 *   GET /state-machines/:type/transitions?from → { success, data: TransitionDef[] }
 *   POST /resources/:id/transition             → { success, data: TransitionResult }
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResourceRecord {
  id:         string;
  org_id:     string;
  project_id: string | null;
  type:       string;
  name:       string;
  state:      string;
  data:       Record<string, unknown>;
  parent_id:  string | null;
  created_at: string;
  updated_at: string;
}

export interface TransitionDef {
  id:      string;
  from:    string;
  to:      string;
  label:   string;
  guards:  unknown[];
  actions: unknown[];
}

export interface TransitionResult {
  status:          string;   // 'completed' | 'approval_required' | 'blocked'
  newState?:       string;
  approvalTaskId?: string;
  pendingToState?: string;
  reason?:         string;
}

export interface UseResourceStateResult {
  resource:    ResourceRecord | null;
  transitions: TransitionDef[];
  loading:     boolean;
  error:       string | null;
  /** Trigger a state transition. Throws on network failure. */
  transition:  (toState: string) => Promise<TransitionResult>;
  refresh:     () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useResourceState(
  resourceId:   string,
  resourceType: string,
  orgId:        string,
): UseResourceStateResult {
  const [resource,    setResource]    = useState<ResourceRecord | null>(null);
  const [transitions, setTransitions] = useState<TransitionDef[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchResource = useCallback(async (): Promise<ResourceRecord | null> => {
    const res = await apiClient.get<ResourceRecord>(
      `/resources/${resourceId}?organizationId=${orgId}`,
    );
    if (res.success && res.data) {
      setResource(res.data);
      return res.data;
    }
    return null;
  }, [resourceId, orgId]);

  const fetchTransitions = useCallback(async (currentState: string): Promise<void> => {
    const res = await apiClient.get<TransitionDef[]>(
      `/state-machines/${encodeURIComponent(resourceType)}/transitions` +
      `?from=${encodeURIComponent(currentState)}&organizationId=${orgId}`,
    );
    // Controller wraps: { success, data: TransitionDef[] }
    setTransitions(res.success && res.data ? res.data : []);
  }, [resourceType, orgId]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const rec = await fetchResource();
      if (rec) await fetchTransitions(rec.state);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchResource, fetchTransitions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!resourceId || !orgId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`resource-state:${resourceId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'lados_resources',
          filter: `id=eq.${resourceId}`,
        },
        (payload) => {
          const updated = payload.new as ResourceRecord;
          setResource(updated);
          void fetchTransitions(updated.state);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [resourceId, orgId, fetchTransitions]);

  // ── Transition ────────────────────────────────────────────────────────────

  const transition = useCallback(
    async (toState: string): Promise<TransitionResult> => {
      const res = await apiClient.post<TransitionResult>(
        `/resources/${resourceId}/transition?organizationId=${orgId}`,
        { toState },
      );
      if (res.success && res.data) {
        await refresh();
        return res.data;
      }
      throw new Error('Transition request failed');
    },
    [resourceId, orgId, refresh],
  );

  return { resource, transitions, loading, error, transition, refresh };
}
