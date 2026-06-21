-- ============================================================
-- Migration 0029: State Engine — configurable state machines
-- Phase 5 (LCE V1)
--
-- lados_state_machines stores JSON state machine definitions per
-- resource type. Org-specific definitions override system defaults.
-- System defaults (org_id = NULL) are seeded here.
-- ============================================================

-- ── 1. State machines table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lados_state_machines (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type text        NOT NULL,
  definition    jsonb       NOT NULL,
  version       integer     NOT NULL DEFAULT 1,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One machine per resource type per org (NULL org = system default).
-- NULLS NOT DISTINCT requires PostgreSQL 15+.
CREATE UNIQUE INDEX IF NOT EXISTS lados_state_machines_org_type_idx
  ON lados_state_machines (COALESCE(org_id::text, ''), resource_type);

CREATE INDEX IF NOT EXISTS lados_state_machines_org_idx
  ON lados_state_machines (org_id);
CREATE INDEX IF NOT EXISTS lados_state_machines_type_idx
  ON lados_state_machines (resource_type);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION set_lados_state_machines_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lados_state_machines_updated_at
  BEFORE UPDATE ON lados_state_machines
  FOR EACH ROW EXECUTE FUNCTION set_lados_state_machines_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE lados_state_machines ENABLE ROW LEVEL SECURITY;

-- System defaults (org_id IS NULL) are readable by everyone.
-- Org-specific definitions are readable only by members of that org.
CREATE POLICY "state_machines_select" ON lados_state_machines
  FOR SELECT USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = lados_state_machines.org_id
        AND user_id = auth.uid()
    )
  );

-- Only org admins/owners can create/edit org-specific state machines.
CREATE POLICY "state_machines_insert_update_delete" ON lados_state_machines
  FOR ALL USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = lados_state_machines.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── 3. Seed system-default state machines ─────────────────────────────────────
--
-- These are the canonical resource lifecycle definitions for LCE V1.
-- Format:
--   definition = {
--     initial: string,
--     states: { [state]: { label, terminal, color? } },
--     transitions: [{ id, from, to, label, guards[], actions[] }]
--   }
-- Guards: { type: "requires_role", role: string }
--         { type: "requires_approval", title: string, description?: string, assigneeRole?: string }
-- Actions: { type: "emit_event", eventType: string }
--          { type: "notify", title: string, message?: string }
-- ─────────────────────────────────────────────────────────────────────────────

-- job: draft → active ↔ on_hold → complete → closed
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'job', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray" },
    "active":    { "label": "Active",    "terminal": false, "color": "green" },
    "on_hold":   { "label": "On Hold",   "terminal": false, "color": "yellow" },
    "complete":  { "label": "Complete",  "terminal": false, "color": "blue" },
    "cancelled": { "label": "Cancelled", "terminal": true,  "color": "red" },
    "closed":    { "label": "Closed",    "terminal": true,  "color": "slate" }
  },
  "transitions": [
    { "id": "activate",      "from": "draft",     "to": "active",    "label": "Activate",   "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.activated"}] },
    { "id": "hold",          "from": "active",    "to": "on_hold",   "label": "Put On Hold","guards": [], "actions": [] },
    { "id": "resume",        "from": "on_hold",   "to": "active",    "label": "Resume",     "guards": [], "actions": [] },
    { "id": "cancel_active", "from": "active",    "to": "cancelled", "label": "Cancel",     "guards": [], "actions": [] },
    { "id": "cancel_hold",   "from": "on_hold",   "to": "cancelled", "label": "Cancel",     "guards": [], "actions": [] },
    { "id": "complete",      "from": "active",    "to": "complete",  "label": "Complete",   "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.completed"}] },
    { "id": "close",         "from": "complete",  "to": "closed",    "label": "Close",      "guards": [{"type": "requires_approval", "title": "Approve Job Closure", "description": "Review completed job before closing.", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.closed"}] }
  ]
}') ON CONFLICT DO NOTHING;

-- fleet: available ↔ assigned ↔ in_use ↔ maintenance → retired
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'fleet', '{
  "initial": "available",
  "states": {
    "available":   { "label": "Available",   "terminal": false, "color": "green" },
    "assigned":    { "label": "Assigned",    "terminal": false, "color": "blue" },
    "in_use":      { "label": "In Use",      "terminal": false, "color": "orange" },
    "maintenance": { "label": "Maintenance", "terminal": false, "color": "yellow" },
    "retired":     { "label": "Retired",     "terminal": true,  "color": "red" }
  },
  "transitions": [
    { "id": "assign",        "from": "available",   "to": "assigned",    "label": "Assign",          "guards": [], "actions": [] },
    { "id": "unassign",      "from": "assigned",    "to": "available",   "label": "Unassign",        "guards": [], "actions": [] },
    { "id": "start_use",     "from": "assigned",    "to": "in_use",      "label": "Start Use",       "guards": [], "actions": [] },
    { "id": "finish_use",    "from": "in_use",      "to": "available",   "label": "Finish Use",      "guards": [], "actions": [] },
    { "id": "into_maint",    "from": "available",   "to": "maintenance", "label": "Send to Maint.",  "guards": [], "actions": [] },
    { "id": "into_maint2",   "from": "in_use",      "to": "maintenance", "label": "Send to Maint.",  "guards": [], "actions": [] },
    { "id": "from_maint",    "from": "maintenance", "to": "available",   "label": "Return from Maint.","guards": [], "actions": [] },
    { "id": "retire",        "from": "maintenance", "to": "retired",     "label": "Retire",           "guards": [{"type": "requires_approval", "title": "Approve Fleet Retirement", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.retired"}] },
    { "id": "retire_avail",  "from": "available",   "to": "retired",     "label": "Retire",           "guards": [{"type": "requires_approval", "title": "Approve Fleet Retirement", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.retired"}] }
  ]
}') ON CONFLICT DO NOTHING;

-- worker: available ↔ assigned ↔ on_leave → inactive
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'worker', '{
  "initial": "available",
  "states": {
    "available": { "label": "Available", "terminal": false, "color": "green" },
    "assigned":  { "label": "Assigned",  "terminal": false, "color": "blue" },
    "on_leave":  { "label": "On Leave",  "terminal": false, "color": "yellow" },
    "inactive":  { "label": "Inactive",  "terminal": false, "color": "gray" }
  },
  "transitions": [
    { "id": "assign",     "from": "available", "to": "assigned",  "label": "Assign",        "guards": [], "actions": [] },
    { "id": "release",    "from": "assigned",  "to": "available", "label": "Release",       "guards": [], "actions": [] },
    { "id": "leave",      "from": "available", "to": "on_leave",  "label": "Go On Leave",   "guards": [], "actions": [] },
    { "id": "leave2",     "from": "assigned",  "to": "on_leave",  "label": "Go On Leave",   "guards": [], "actions": [] },
    { "id": "return",     "from": "on_leave",  "to": "available", "label": "Return",        "guards": [], "actions": [] },
    { "id": "deactivate", "from": "available", "to": "inactive",  "label": "Deactivate",    "guards": [], "actions": [] },
    { "id": "reactivate", "from": "inactive",  "to": "available", "label": "Reactivate",    "guards": [], "actions": [] }
  ]
}') ON CONFLICT DO NOTHING;

-- material: available → reserved → in_use → depleted
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'material', '{
  "initial": "available",
  "states": {
    "available": { "label": "Available", "terminal": false, "color": "green" },
    "reserved":  { "label": "Reserved",  "terminal": false, "color": "blue" },
    "in_use":    { "label": "In Use",    "terminal": false, "color": "orange" },
    "depleted":  { "label": "Depleted",  "terminal": true,  "color": "red" }
  },
  "transitions": [
    { "id": "reserve",     "from": "available", "to": "reserved",  "label": "Reserve",   "guards": [], "actions": [] },
    { "id": "unreserve",   "from": "reserved",  "to": "available", "label": "Unreserve", "guards": [], "actions": [] },
    { "id": "use",         "from": "reserved",  "to": "in_use",    "label": "Use",       "guards": [], "actions": [] },
    { "id": "return",      "from": "in_use",    "to": "available", "label": "Return",    "guards": [], "actions": [] },
    { "id": "deplete_r",   "from": "reserved",  "to": "depleted",  "label": "Deplete",   "guards": [], "actions": [] },
    { "id": "deplete_u",   "from": "in_use",    "to": "depleted",  "label": "Deplete",   "guards": [], "actions": [] },
    { "id": "deplete_a",   "from": "available", "to": "depleted",  "label": "Deplete",   "guards": [], "actions": [] }
  ]
}') ON CONFLICT DO NOTHING;

-- site: preparation → active ↔ suspended → complete
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'site', '{
  "initial": "preparation",
  "states": {
    "preparation": { "label": "Preparation", "terminal": false, "color": "yellow" },
    "active":      { "label": "Active",      "terminal": false, "color": "green" },
    "suspended":   { "label": "Suspended",   "terminal": false, "color": "orange" },
    "complete":    { "label": "Complete",    "terminal": true,  "color": "blue" }
  },
  "transitions": [
    { "id": "open",       "from": "preparation", "to": "active",    "label": "Open Site",  "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.activated"}] },
    { "id": "suspend",    "from": "active",      "to": "suspended", "label": "Suspend",    "guards": [], "actions": [] },
    { "id": "resume",     "from": "suspended",   "to": "active",    "label": "Resume",     "guards": [], "actions": [] },
    { "id": "complete_a", "from": "active",      "to": "complete",  "label": "Complete",   "guards": [{"type": "requires_approval", "title": "Site Completion Approval", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.completed"}] },
    { "id": "complete_s", "from": "suspended",   "to": "complete",  "label": "Complete",   "guards": [{"type": "requires_approval", "title": "Site Completion Approval", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.completed"}] }
  ]
}') ON CONFLICT DO NOTHING;

-- trip (Contractor Edition): pending → in_progress → complete → invoiced
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'trip', '{
  "initial": "pending",
  "states": {
    "pending":     { "label": "Pending",     "terminal": false, "color": "gray" },
    "in_progress": { "label": "In Progress", "terminal": false, "color": "blue" },
    "complete":    { "label": "Complete",    "terminal": false, "color": "green" },
    "invoiced":    { "label": "Invoiced",    "terminal": true,  "color": "purple" },
    "cancelled":   { "label": "Cancelled",   "terminal": true,  "color": "red" }
  },
  "transitions": [
    { "id": "start",    "from": "pending",     "to": "in_progress", "label": "Start Trip",  "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.activated"}] },
    { "id": "finish",   "from": "in_progress", "to": "complete",    "label": "Finish Trip", "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.completed"}] },
    { "id": "invoice",  "from": "complete",    "to": "invoiced",    "label": "Invoice",     "guards": [{"type": "requires_approval", "title": "Approve Trip for Invoicing", "description": "Review completed trip details before invoicing.", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.invoiced"}] },
    { "id": "cancel_p", "from": "pending",     "to": "cancelled",   "label": "Cancel",      "guards": [], "actions": [] },
    { "id": "cancel_i", "from": "in_progress", "to": "cancelled",   "label": "Cancel",      "guards": [], "actions": [] }
  ]
}') ON CONFLICT DO NOTHING;

-- invoice (Contractor Edition): draft → pending_approval → approved → sent → paid | cancelled
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'invoice', '{
  "initial": "draft",
  "states": {
    "draft":            { "label": "Draft",            "terminal": false, "color": "gray" },
    "pending_approval": { "label": "Pending Approval", "terminal": false, "color": "yellow" },
    "approved":         { "label": "Approved",         "terminal": false, "color": "green" },
    "sent":             { "label": "Sent",             "terminal": false, "color": "blue" },
    "paid":             { "label": "Paid",             "terminal": true,  "color": "emerald" },
    "cancelled":        { "label": "Cancelled",        "terminal": true,  "color": "red" }
  },
  "transitions": [
    { "id": "submit",   "from": "draft",            "to": "pending_approval", "label": "Submit for Approval", "guards": [], "actions": [{"type": "notify", "title": "Invoice Submitted for Approval"}] },
    { "id": "approve",  "from": "pending_approval", "to": "approved",         "label": "Approve",   "guards": [{"type": "requires_approval", "title": "Approve Invoice", "description": "Review and approve invoice before sending.", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.approved"}] },
    { "id": "reject",   "from": "pending_approval", "to": "draft",            "label": "Reject",    "guards": [], "actions": [] },
    { "id": "send",     "from": "approved",         "to": "sent",             "label": "Send",      "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.sent"}] },
    { "id": "pay",      "from": "sent",             "to": "paid",             "label": "Mark Paid", "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.paid"}] },
    { "id": "cancel_d", "from": "draft",            "to": "cancelled",        "label": "Cancel",    "guards": [], "actions": [] },
    { "id": "cancel_p", "from": "pending_approval", "to": "cancelled",        "label": "Cancel",    "guards": [], "actions": [] },
    { "id": "cancel_a", "from": "approved",         "to": "cancelled",        "label": "Cancel",    "guards": [], "actions": [] }
  ]
}') ON CONFLICT DO NOTHING;

-- payment (Contractor Edition): scheduled → processing → completed | failed
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'payment', '{
  "initial": "scheduled",
  "states": {
    "scheduled":  { "label": "Scheduled",  "terminal": false, "color": "gray" },
    "processing": { "label": "Processing", "terminal": false, "color": "blue" },
    "completed":  { "label": "Completed",  "terminal": true,  "color": "green" },
    "failed":     { "label": "Failed",     "terminal": false, "color": "red" },
    "cancelled":  { "label": "Cancelled",  "terminal": true,  "color": "slate" }
  },
  "transitions": [
    { "id": "process",  "from": "scheduled",  "to": "processing", "label": "Process",       "guards": [], "actions": [] },
    { "id": "complete", "from": "processing", "to": "completed",  "label": "Mark Complete", "guards": [{"type": "requires_approval", "title": "Confirm Payment Completion", "assigneeRole": "owner"}], "actions": [{"type": "emit_event", "eventType": "resource.paid"}] },
    { "id": "fail",     "from": "processing", "to": "failed",     "label": "Mark Failed",   "guards": [], "actions": [{"type": "emit_event", "eventType": "resource.failed"}] },
    { "id": "retry",    "from": "failed",     "to": "scheduled",  "label": "Retry",         "guards": [], "actions": [] },
    { "id": "cancel_s", "from": "scheduled",  "to": "cancelled",  "label": "Cancel",        "guards": [], "actions": [] },
    { "id": "cancel_f", "from": "failed",     "to": "cancelled",  "label": "Cancel",        "guards": [], "actions": [] }
  ]
}') ON CONFLICT DO NOTHING;

-- custom: no states or transitions enforced — any change allowed
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'custom', '{
  "initial": "active",
  "states": {},
  "transitions": []
}') ON CONFLICT DO NOTHING;
