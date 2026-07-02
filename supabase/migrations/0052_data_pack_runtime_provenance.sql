-- ============================================================
-- Migration 0052: Data Pack Runtime Provenance Logging
-- Phase 19C
-- ============================================================
-- Adds per-node Data Pack usage metadata to execution_logs so
-- QS/commercial runs can show exactly which governed data items
-- influenced a workflow execution.
-- ============================================================

ALTER TABLE execution_logs
  ADD COLUMN IF NOT EXISTS data_pack_usages jsonb NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS execution_logs_data_pack_usages_idx
  ON execution_logs USING gin(data_pack_usages);

COMMENT ON COLUMN execution_logs.data_pack_usages IS
  'Array of Data Pack item provenance records referenced by this node config at runtime.';
