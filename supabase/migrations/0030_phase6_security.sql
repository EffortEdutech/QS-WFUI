-- ============================================================
-- Migration 0030: Phase 6 — Security Engine Hardening
--
-- 1. Expand organization_members.role to include Contractor Edition roles:
--    driver, operator
-- 2. Create api_keys table for programmatic access
-- ============================================================

-- ── 1. Expand role CHECK constraint ───────────────────────────────────────────
--
-- Current: owner | admin | member | viewer
-- New:     owner | admin | member | viewer | driver | operator
--
-- Contractor Edition role hierarchy (highest → lowest):
--   owner    — full control, manages org, users, financials
--   admin    — manages resources, workflows, approvals; no billing
--   member   — creates resources, triggers workflows, submits data
--   driver   — sees and updates only their own assigned trips/jobs
--   operator — views and updates equipment/fleet; no financial access
--   viewer   — read-only across the org

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'driver', 'operator'));

COMMENT ON COLUMN organization_members.role IS
  'owner|admin|member|viewer|driver|operator — Contractor Edition role hierarchy';

-- ── 2. api_keys table ─────────────────────────────────────────────────────────
--
-- Stores hashed API keys for programmatic access.
-- Raw key is shown once at creation, then discarded — only the SHA-256 hash
-- is stored. Key format: lados_<32 random hex bytes> (total 71 chars).
--
-- The key grants access as a service account for the given org at the given role.
-- Keys inherit the same permission matrix as human members of the same role.

CREATE TABLE IF NOT EXISTS api_keys (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  key_hash      text        NOT NULL UNIQUE,   -- SHA-256 hex of the raw key
  key_prefix    text        NOT NULL,           -- first 10 chars for identification
  role          text        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'driver', 'operator')),
  scopes        text[]      NOT NULL DEFAULT '{}',  -- future: scope restrictions
  expires_at    timestamptz,
  last_used_at  timestamptz,
  active        boolean     NOT NULL DEFAULT true,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx      ON api_keys (org_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx     ON api_keys (key_hash) WHERE active = true;
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx   ON api_keys (key_prefix);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_api_keys_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION set_api_keys_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Members can list their org's keys (but never see the hash)
CREATE POLICY "api_keys_select_members" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = api_keys.org_id
        AND user_id = auth.uid()
    )
  );

-- Only owners/admins can create/update/delete keys
CREATE POLICY "api_keys_manage_admins" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = api_keys.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
