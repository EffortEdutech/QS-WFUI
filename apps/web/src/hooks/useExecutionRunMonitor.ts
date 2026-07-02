'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useExecutionStore } from '@/stores';
import type { NodeLog, RunStatus, RunSummary } from '@/stores';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'paused']);

export function useExecutionRunMonitor(runId: string | null) {
  const setRunSummary = useExecutionStore((state) => state.setRunSummary);
  const setNodeLogs = useExecutionStore((state) => state.setNodeLogs);
  const setRunError = useExecutionStore((state) => state.setRunError);
  const setPolling = useExecutionStore((state) => state.setPolling);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let polls = 0;
    const maxPolls = 150;

    async function fetchLogs() {
      const logsRes = await apiClient.get<NodeLog[]>(`/runs/${runId}/logs`);
      if (!cancelled && logsRes.success) {
        setNodeLogs(logsRes.data ?? []);
      }
    }

    async function poll() {
      polls += 1;
      if (polls > maxPolls) {
        if (!cancelled) {
          setRunError('Run timed out waiting for completion');
          setPolling(false);
        }
        return;
      }

      const runRes = await apiClient.get<RunSummary>(`/runs/${runId}`);
      if (cancelled) return;

      if (!runRes.success || !runRes.data) {
        setRunError('Could not fetch run status');
        setPolling(false);
        return;
      }

      const run = runRes.data;
      setRunSummary({
        ...run,
        status: run.status as RunStatus,
      });

      if (TERMINAL_STATUSES.has(run.status)) {
        await fetchLogs();
        if (!cancelled) setPolling(false);
        return;
      }

      timer = setTimeout(() => void poll(), 2000);
    }

    setPolling(true);
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setPolling(false);
    };
  }, [runId, setNodeLogs, setPolling, setRunError, setRunSummary]);
}
