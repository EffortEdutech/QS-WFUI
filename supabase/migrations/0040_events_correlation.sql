-- Migration 0040 — Event correlation & run tracking
--
-- Adds two index-backed columns to lados_events:
--   correlation_id  — groups all events that belong to the same logical operation
--                     (e.g. every event fired during a single workflow run)
--   run_id          — direct reference to a workflow execution run
--
-- Both are optional (NULL = event not part of a correlated batch / not from a run).

ALTER TABLE lados_events
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS run_id         text;

CREATE INDEX IF NOT EXISTS idx_lados_events_correlation
  ON lados_events (org_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lados_events_run
  ON lados_events (org_id, run_id)
  WHERE run_id IS NOT NULL;
