-- =============================================================================
-- Migration 0028 — Event Bus
-- Phase 4: lados_events + lados_event_subscriptions
--
-- lados_events            — immutable universal event log
-- lados_event_subscriptions — rules: "when event X fires, trigger workflow Y"
-- =============================================================================

-- ── lados_events ──────────────────────────────────────────────────────────────
--
-- Append-only. Never updated or deleted (except by data-retention policy).
-- Every significant domain action writes here: resource changes, workflow
-- lifecycle, approval decisions, custom events from workflow nodes.

CREATE TABLE lados_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type         text        NOT NULL,   -- e.g. 'resource.state_changed'
  source_type  text,                   -- 'resource' | 'workflow' | 'approval' | 'node' | 'system'
  source_id    text,                   -- id of the originating entity
  actor_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── lados_event_subscriptions ─────────────────────────────────────────────────
--
-- Each row says: "when an event of type <event_type> fires in <org_id>,
-- trigger workflow <workflow_id> with the event payload as inputs."
-- event_type supports prefix wildcards: 'resource.*' matches all resource events.

CREATE TABLE lados_event_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,   -- exact type or 'resource.*' wildcard prefix
  workflow_id  uuid        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  filter       jsonb       NOT NULL DEFAULT '{}',  -- optional payload filter (future)
  active       boolean     NOT NULL DEFAULT true,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_events_org_type       ON lados_events(org_id, type);
CREATE INDEX idx_events_org_created    ON lados_events(org_id, created_at DESC);
CREATE INDEX idx_events_source         ON lados_events(source_type, source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX idx_events_actor          ON lados_events(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX idx_event_subs_org_type   ON lados_event_subscriptions(org_id, event_type)
  WHERE active = true;
CREATE INDEX idx_event_subs_workflow   ON lados_event_subscriptions(workflow_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE lados_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lados_event_subscriptions ENABLE ROW LEVEL SECURITY;

-- Events: org members can read; only service role inserts (no client insert policy)
CREATE POLICY "events_select" ON lados_events
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Event subscriptions: org members read; authenticated members manage their org's
CREATE POLICY "event_subs_select" ON lados_event_subscriptions
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_subs_insert" ON lados_event_subscriptions
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_subs_update" ON lados_event_subscriptions
  FOR UPDATE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_subs_delete" ON lados_event_subscriptions
  FOR DELETE USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
