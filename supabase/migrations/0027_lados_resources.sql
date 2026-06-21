-- =============================================================================
-- Migration 0027 — Resource Engine
-- Phase 3: lados_resources + lados_resource_events
--
-- lados_resources  — generic resource store (job, fleet, worker, material, site)
-- lados_resource_events — immutable state-change history for every resource
-- =============================================================================

-- ── lados_resources ───────────────────────────────────────────────────────────

CREATE TABLE lados_resources (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    uuid        REFERENCES projects(id) ON DELETE SET NULL,
  type          text        NOT NULL
                            CHECK (type IN ('job','fleet','worker','material','site','custom')),
  name          text        NOT NULL,
  state         text        NOT NULL DEFAULT 'draft',
  data          jsonb       NOT NULL DEFAULT '{}',
  parent_id     uuid        REFERENCES lados_resources(id) ON DELETE SET NULL,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── lados_resource_events ─────────────────────────────────────────────────────

CREATE TABLE lados_resource_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid        NOT NULL REFERENCES lados_resources(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,   -- 'created' | 'updated' | 'state_changed' | 'linked'
  from_state    text,
  to_state      text,
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_resources_org_type    ON lados_resources(org_id, type);
CREATE INDEX idx_resources_org_state   ON lados_resources(org_id, state);
CREATE INDEX idx_resources_project     ON lados_resources(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX idx_resources_parent      ON lados_resources(parent_id)
  WHERE parent_id IS NOT NULL;
CREATE INDEX idx_resource_events_res   ON lados_resource_events(resource_id);
CREATE INDEX idx_resource_events_actor ON lados_resource_events(actor_id)
  WHERE actor_id IS NOT NULL;

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_lados_resources_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lados_resources_updated_at
  BEFORE UPDATE ON lados_resources
  FOR EACH ROW EXECUTE FUNCTION set_lados_resources_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE lados_resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lados_resource_events ENABLE ROW LEVEL SECURITY;

-- Resources: org members can read; authenticated users with org membership can write
CREATE POLICY "resources_select" ON lados_resources
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "resources_insert" ON lados_resources
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "resources_update" ON lados_resources
  FOR UPDATE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "resources_delete" ON lados_resources
  FOR DELETE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Resource events: read-only for org members; insert via service role only
CREATE POLICY "resource_events_select" ON lados_resource_events
  FOR SELECT USING (
    resource_id IN (
      SELECT id FROM lados_resources
      WHERE org_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service-role bypass handles inserts (no anon/user insert policy needed)
