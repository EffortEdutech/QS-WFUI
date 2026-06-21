'use client';

/**
 * Approval Inbox — Phase 1
 *
 * Lists all pending approval tasks for the current user's organisations.
 * Each card shows the task title, associated workflow/project, and
 * Approve / Reject buttons that call POST /approvals/:taskId/decide.
 *
 * AI guardrail: human must approve. AI is advisory only.
 * Approval is never auto-granted.
 */

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface ApprovalTask {
  id: string;
  title: string;
  description: string | null;
  data: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected';
  assignee_role: string | null;
  created_at: string;
  node_id: string | null;
  node_name: string | null;
  execution_id: string;
  workflow_id: string;
  project_id: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function TaskCard({
  task,
  onDecide,
}: {
  task: ApprovalTask;
  onDecide: (taskId: string, decision: 'approved' | 'rejected', comments: string) => Promise<void>;
}) {
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      await onDecide(task.id, decision, comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">
          Pending
        </span>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        {task.node_name && (
          <span>Node: <span className="text-gray-600 font-medium">{task.node_name}</span></span>
        )}
        {task.assignee_role && (
          <span>Role: <span className="text-gray-600 font-medium">{task.assignee_role}</span></span>
        )}
        <span>Requested: <span className="text-gray-600">{fmt(task.created_at)}</span></span>
      </div>

      {/* Data snapshot (collapsible) */}
      {task.data && Object.keys(task.data).length > 0 && (
        <details className="text-[11px] text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700 select-none">
            View task data ({Object.keys(task.data).length} fields)
          </summary>
          <pre className="mt-1 bg-gray-50 rounded p-2 text-[10px] overflow-x-auto max-h-40">
            {JSON.stringify(task.data, null, 2)}
          </pre>
        </details>
      )}

      {/* Comments */}
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Optional comments…"
        rows={2}
        maxLength={1000}
        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => void decide('approved')}
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : '✓ Approve'}
        </button>
        <button
          onClick={() => void decide('rejected')}
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Saving…' : '✗ Reject'}
        </button>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiClient.get<ApprovalTask[]>('/approvals');
    if (res.error) {
      setError(typeof res.error === 'string' ? res.error : 'Failed to load approvals');
    } else {
      setTasks(res.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDecide(
    taskId: string,
    decision: 'approved' | 'rejected',
    comments: string,
  ) {
    const res = await apiClient.post<unknown>(`/approvals/${taskId}/decide`, {
      decision,
      comments,
    });
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : 'Decision failed');
    // Remove from list on success
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approval Inbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Workflows paused for human sign-off. AI output is advisory only — your approval is required.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium text-gray-500">No pending approvals</p>
          <p className="text-xs text-gray-400 mt-1">
            Workflows requiring human approval will appear here.
          </p>
        </div>
      )}

      {/* Task cards */}
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDecide={handleDecide} />
        ))}
      </div>
    </div>
  );
}
