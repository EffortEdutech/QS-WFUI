-- ============================================================
-- Migration 0026: Phase 1 — Real Approvals + Workflow Publish
-- LCE V1 Phase 1 (P1-001 · P1-002)
-- ============================================================

-- ── 1. Execution checkpoint columns ────────────────────────────────────────
--
-- When a workflow pauses at a human_approval node:
--   paused_at_node_id  — the node that triggered the pause
--   checkpoint_outputs — accumulated node outputs up to (not including) the paused node
--
-- These are used by resumeRun() to replay from the exact pause point.

ALTER TABLE execution_runs
  ADD COLUMN IF NOT EXISTS paused_at_node_id  text,
  ADD COLUMN IF NOT EXISTS checkpoint_outputs jsonb DEFAULT '{}';

-- ── 2. Workflow publish columns ─────────────────────────────────────────────
--
-- A workflow has a live editable definition (the canvas) and a published
-- snapshot (the version that executions bind to).
--
-- published_version_id  — FK to workflow_versions.id (the active published version)
-- published_at          — when the workflow was last published
-- published_by          — who published it

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS published_version_id uuid REFERENCES workflow_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at          timestamptz,
  ADD COLUMN IF NOT EXISTS published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for quick lookup of published workflows
CREATE INDEX IF NOT EXISTS idx_workflows_published
  ON workflows (published_version_id)
  WHERE published_version_id IS NOT NULL;

-- ── 3. Approval tasks: add run_id index + tighten status ───────────────────
--
-- Ensure we can quickly find all pending approvals for a run.

CREATE INDEX IF NOT EXISTS idx_approval_tasks_run_status
  ON approval_tasks (execution_id, status)
  WHERE status = 'pending';
