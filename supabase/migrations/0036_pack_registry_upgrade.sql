-- Migration 0036 — Phase 14: Pack Registry Upgrade
-- Adds version tracking + source metadata to packs table.
-- Creates pack_node_overrides for per-org node-level enable/disable.
--
-- Fixed: uses 'organizations' / 'organization_members' (American spelling)
-- Apply via: Supabase Dashboard → SQL Editor → Run

-- ── 1. Upgrade packs table ──────────────────────────────────────────────────

ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS installed_from   text NOT NULL DEFAULT 'startup-sync',
  ADD COLUMN IF NOT EXISTS previous_version text,
  ADD COLUMN IF NOT EXISTS checksum         text;

COMMENT ON COLUMN packs.installed_from   IS 'startup-sync | registry | upload';
COMMENT ON COLUMN packs.previous_version IS 'Version string before the last upgrade, for rollback reference';
COMMENT ON COLUMN packs.checksum         IS 'SHA-256 of the pack bundle at install time';

-- ── 2. Create pack_node_overrides ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pack_node_overrides (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pack_id       text        NOT NULL REFERENCES packs(id)         ON DELETE CASCADE,
  node_type     text        NOT NULL,
  is_enabled    boolean     NOT NULL DEFAULT true,
  overridden_by uuid        REFERENCES auth.users(id),
  overridden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, pack_id, node_type)
);

COMMENT ON TABLE pack_node_overrides IS
  'Per-org node-level enable/disable overrides. '
  'Disabled node types are passed as skipNodes when a workflow run is enqueued.';

CREATE INDEX IF NOT EXISTS idx_pack_node_overrides_org  ON pack_node_overrides(org_id);
CREATE INDEX IF NOT EXISTS idx_pack_node_overrides_pack ON pack_node_overrides(pack_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE pack_node_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_node_overrides" ON pack_node_overrides
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_admins_insert_node_overrides" ON pack_node_overrides
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_admins_update_node_overrides" ON pack_node_overrides
  FOR UPDATE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_admins_delete_node_overrides" ON pack_node_overrides
  FOR DELETE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
