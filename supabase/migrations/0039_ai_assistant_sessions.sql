-- =============================================================================
-- Migration 0039 — AI Assistant Sessions (Phase 2C)
--
-- Creates the ai_assistant_sessions table for tracking Owner Assistant
-- conversation sessions. Each session groups multiple lados_ai_outputs turns
-- under a human-readable title and stores session-level metadata.
--
-- Sessions are created lazily on the first message turn.
-- Turns are stored in lados_ai_outputs (migration 0035).
--
-- Phase 2C / LADOS V4 Sprint Plan
-- =============================================================================

-- ── ai_assistant_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_assistant_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Client-assigned session UUID (matches lados_ai_outputs.session_id)
  session_id  text        NOT NULL UNIQUE,

  -- Human-readable title — derived from the first user message
  title       text        NOT NULL DEFAULT 'New conversation',

  -- Total token spend across all turns in this session
  total_tokens  integer   NOT NULL DEFAULT 0,

  -- Turn counters
  turn_count    integer   NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_sessions_org_id    ON ai_assistant_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_actor_id  ON ai_assistant_sessions(actor_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_session_id ON ai_assistant_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at ON ai_assistant_sessions(updated_at DESC);

-- ── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE ai_assistant_sessions ENABLE ROW LEVEL SECURITY;

-- Owners and admins can read sessions for their org
CREATE POLICY "ai_sessions_read_owner_admin" ON ai_assistant_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = ai_assistant_sessions.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Actors can only see their own sessions
CREATE POLICY "ai_sessions_read_own" ON ai_assistant_sessions
  FOR SELECT USING (actor_id = auth.uid());

-- ── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ai_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_sessions_updated_at
  BEFORE UPDATE ON ai_assistant_sessions
  FOR EACH ROW EXECUTE FUNCTION update_ai_sessions_updated_at();

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE  ai_assistant_sessions IS 'Owner Assistant conversation sessions. Turns are in lados_ai_outputs grouped by session_id.';
COMMENT ON COLUMN ai_assistant_sessions.session_id IS 'Client-assigned UUID matching lados_ai_outputs.session_id';
COMMENT ON COLUMN ai_assistant_sessions.title IS 'First 60 chars of the first user message, used as display title';
