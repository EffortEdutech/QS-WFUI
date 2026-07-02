import { create } from 'zustand';

export type NodeRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting';

export type RunStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused';

export interface NodeLog {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: NodeRunStatus;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: { code: string; message: string };
  messages?: string[];
  dataPackUsages?: DataPackUsage[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface DataPackUsage {
  itemId: string;
  itemKey: string;
  title: string;
  unit: string | null;
  packSlug: string;
  packName: string;
  version: string;
  collectionKey: string;
  collectionName: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceDate: string | null;
  region: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  classification: string | null;
  advisoryStatus: string;
  applicabilityNotes: string | null;
  assumptions: string | null;
}

export interface RunSummary {
  runId: string;
  status: RunStatus | string;
  durationMs: number;
  nodeCount: number;
}

interface ExecutionState {
  runId: string | null;
  runStatus: RunStatus;
  runSummary: RunSummary | null;
  nodeLogs: Record<string, NodeLog>;
  nodeLogList: NodeLog[];
  runError: string | null;
  streamConnected: boolean;
  polling: boolean;

  startRun: (runId: string) => void;
  setRunStatus: (runStatus: RunStatus) => void;
  setRunSummary: (runSummary: RunSummary | null) => void;
  setNodeLogs: (logs: NodeLog[]) => void;
  upsertNodeLog: (log: NodeLog) => void;
  setRunError: (runError: string | null) => void;
  setStreamConnected: (streamConnected: boolean) => void;
  setPolling: (polling: boolean) => void;
  resetRun: () => void;
}

const initialExecutionState = {
  runId: null,
  runStatus: 'idle' as RunStatus,
  runSummary: null as RunSummary | null,
  nodeLogs: {} as Record<string, NodeLog>,
  nodeLogList: [] as NodeLog[],
  runError: null,
  streamConnected: false,
  polling: false,
};

export const useExecutionStore = create<ExecutionState>((set) => ({
  ...initialExecutionState,

  startRun: (runId) =>
    set({
      runId,
      runStatus: 'starting',
      runSummary: { runId, status: 'starting', durationMs: 0, nodeCount: 0 },
      nodeLogs: {},
      nodeLogList: [],
      runError: null,
      streamConnected: false,
      polling: true,
    }),
  setRunStatus: (runStatus) => set({ runStatus }),
  setRunSummary: (runSummary) =>
    set({
      runSummary,
      runStatus: (runSummary?.status as RunStatus | undefined) ?? 'idle',
    }),
  setNodeLogs: (logs) =>
    set({
      nodeLogList: logs,
      nodeLogs: Object.fromEntries(logs.map((log) => [log.nodeId, log])),
    }),
  upsertNodeLog: (log) =>
    set((state) => {
      const nodeLogs = { ...state.nodeLogs, [log.nodeId]: log };
      return {
        nodeLogs,
        nodeLogList: Object.values(nodeLogs),
      };
    }),
  setRunError: (runError) => set({ runError }),
  setStreamConnected: (streamConnected) => set({ streamConnected }),
  setPolling: (polling) => set({ polling }),
  resetRun: () => set(initialExecutionState),
}));
