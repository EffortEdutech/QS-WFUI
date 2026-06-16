-- ============================================================
-- Migration 0006: Execution Engine Tables
-- Sprint 6 (S6-001)
-- ============================================================

-- ── execution_runs ────────────────────────────────────────────────────────────
-- One row per workflow run attempt.

CREATE TABLE IF NOT EXISTS execution_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     uuid NOT NULL REFERENCES workflows(id),
  project_id      uuid NOT NULL REFERENCES projects(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),

  -- Immutable snapshot of the workflow definition at run time
  workflow_snapshot jsonb NOT NULL,

  -- Execution metadata
  status          text NOT NULL DEFAULT 'created'
                  CHECK (status IN (
                    'created','queued','validating','planning',
                    'running','waiting','paused','retrying',
                    'completed','failed','cancelled','timed_out'
                  )),
  trigger_type    text NOT NULL DEFAULT 'manual'
                  CHECK (trigger_type IN ('manual','schedule','webhook','api','sub_workflow')),

  -- Inputs provided at trigger time
  inputs          jsonb NOT NULL DEFAULT '{}',

  -- Final outputs after completion
  outputs         jsonb,

  -- Error info if failed
  error           jsonb,

  -- Timing
  started_by      uuid REFERENCES auth.users(id),
  started_at      timestamptz,
  completed_at    timestamptz,
  duration_ms     integer,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_runs_workflow_id_idx ON execution_runs(workflow_id);
CREATE INDEX IF NOT EXISTS execution_runs_project_id_idx  ON execution_runs(project_id);
CREATE INDEX IF NOT EXISTS execution_runs_status_idx      ON execution_runs(status);

CREATE TRIGGER set_execution_runs_updated_at
  BEFORE UPDATE ON execution_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── execution_logs ────────────────────────────────────────────────────────────
-- Per-node log entries written during execution.

CREATE TABLE IF NOT EXISTS execution_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_id     text NOT NULL,   -- node instance id from workflow definition
  node_type   text NOT NULL,   -- e.g. "qs.read_boq"
  node_name   text,

  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN (
                'pending','running','completed','failed','skipped','waiting'
              )),

  -- Data
  inputs      jsonb,
  outputs     jsonb,
  error       jsonb,

  -- Log messages emitted during node execution
  messages    jsonb NOT NULL DEFAULT '[]',

  -- Timing
  started_at    timestamptz,
  completed_at  timestamptz,
  duration_ms   integer,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_logs_run_id_idx ON execution_logs(run_id);
CREATE INDEX IF NOT EXISTS execution_logs_status_idx ON execution_logs(status);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE execution_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read execution runs in their org"
  ON execution_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = execution_runs.organization_id
        AND user_id = auth.uid()
    )
  );
CREATE POLICY "Members can insert execution runs"
  ON execution_runs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = execution_runs.organization_id
        AND user_id = auth.uid()
    )
  );
CREATE POLICY "Members can update their own runs"
  ON execution_runs FOR UPDATE TO authenticated
  USING (started_by = auth.uid());

ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read logs for runs they can see"
  ON execution_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM execution_runs er
      JOIN organization_members om ON om.organization_id = er.organization_id
      WHERE er.id = execution_logs.run_id
        AND om.user_id = auth.uid()
    )
  );
