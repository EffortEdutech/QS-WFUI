-- =============================================================================
-- Migration 0032 — Phase 9: Contractor Edition
--
-- 1. Expand lados_resources.type CHECK to include all Contractor Edition types
-- 2. Add state machines for new resource types
-- 3. Seed contractor-pack in packs table
-- 4. Register contractor-pack nodes in registered_nodes
-- =============================================================================

-- ── 1. Expand type CHECK ──────────────────────────────────────────────────────
--
-- Original (0027): ('job','fleet','worker','material','site','custom')
-- Phase 5 (0029) added trip/invoice/payment to TypeScript but NOT to DB constraint.
-- This migration aligns the DB constraint with the full Contractor Edition type list.

ALTER TABLE lados_resources
  DROP CONSTRAINT IF EXISTS lados_resources_type_check;

ALTER TABLE lados_resources
  ADD CONSTRAINT lados_resources_type_check
  CHECK (type IN (
    -- original core types
    'job', 'fleet', 'worker', 'material', 'site',
    -- Phase 5 additions (were in TypeScript but missing from DB)
    'trip', 'invoice', 'payment',
    -- Phase 9 Contractor Edition additions
    'customer', 'driver', 'vehicle', 'equipment',
    'fuel_receipt', 'maintenance_record', 'expense',
    -- escape hatch
    'custom'
  ));

-- ── 2. State machines for new Contractor Edition resource types ───────────────

-- customer
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'customer', '{
  "initial": "active",
  "states": {
    "active":    { "label": "Active",    "terminal": false, "color": "green" },
    "inactive":  { "label": "Inactive",  "terminal": false, "color": "gray" },
    "blocked":   { "label": "Blocked",   "terminal": false, "color": "red" },
    "archived":  { "label": "Archived",  "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "active",   "to": "inactive", "label": "Deactivate" },
    { "from": "active",   "to": "blocked",  "label": "Block" },
    { "from": "inactive", "to": "active",   "label": "Reactivate" },
    { "from": "blocked",  "to": "active",   "label": "Unblock" },
    { "from": "active",   "to": "archived", "label": "Archive" },
    { "from": "inactive", "to": "archived", "label": "Archive" }
  ]
}') ON CONFLICT DO NOTHING;

-- driver
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'driver', '{
  "initial": "available",
  "states": {
    "available":  { "label": "Available",    "terminal": false, "color": "green" },
    "on_trip":    { "label": "On Trip",      "terminal": false, "color": "blue" },
    "on_leave":   { "label": "On Leave",     "terminal": false, "color": "yellow" },
    "suspended":  { "label": "Suspended",    "terminal": false, "color": "red" },
    "inactive":   { "label": "Inactive",     "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "available", "to": "on_trip",   "label": "Dispatch" },
    { "from": "on_trip",   "to": "available", "label": "Complete Trip" },
    { "from": "available", "to": "on_leave",  "label": "Start Leave" },
    { "from": "on_leave",  "to": "available", "label": "Return from Leave" },
    { "from": "available", "to": "suspended", "label": "Suspend" },
    { "from": "suspended", "to": "available", "label": "Reinstate" },
    { "from": "available", "to": "inactive",  "label": "Deactivate" }
  ]
}') ON CONFLICT DO NOTHING;

-- vehicle
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'vehicle', '{
  "initial": "available",
  "states": {
    "available":    { "label": "Available",     "terminal": false, "color": "green" },
    "deployed":     { "label": "Deployed",      "terminal": false, "color": "blue" },
    "maintenance":  { "label": "Maintenance",   "terminal": false, "color": "yellow" },
    "breakdown":    { "label": "Breakdown",     "terminal": false, "color": "red" },
    "retired":      { "label": "Retired",       "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "available",   "to": "deployed",    "label": "Deploy" },
    { "from": "deployed",    "to": "available",   "label": "Return" },
    { "from": "available",   "to": "maintenance", "label": "Send for Service" },
    { "from": "maintenance", "to": "available",   "label": "Service Complete" },
    { "from": "deployed",    "to": "breakdown",   "label": "Report Breakdown" },
    { "from": "breakdown",   "to": "maintenance", "label": "Tow to Workshop" },
    { "from": "available",   "to": "retired",     "label": "Retire" }
  ]
}') ON CONFLICT DO NOTHING;

-- equipment (backhoe, compactor, etc. — tracked by hours)
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'equipment', '{
  "initial": "available",
  "states": {
    "available":    { "label": "Available",     "terminal": false, "color": "green" },
    "deployed":     { "label": "Deployed",      "terminal": false, "color": "blue" },
    "maintenance":  { "label": "Maintenance",   "terminal": false, "color": "yellow" },
    "breakdown":    { "label": "Breakdown",     "terminal": false, "color": "red" },
    "retired":      { "label": "Retired",       "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "available",   "to": "deployed",    "label": "Deploy" },
    { "from": "deployed",    "to": "available",   "label": "Return" },
    { "from": "available",   "to": "maintenance", "label": "Send for Service" },
    { "from": "maintenance", "to": "available",   "label": "Service Complete" },
    { "from": "deployed",    "to": "breakdown",   "label": "Report Breakdown" },
    { "from": "breakdown",   "to": "maintenance", "label": "Tow to Workshop" },
    { "from": "available",   "to": "retired",     "label": "Retire" }
  ]
}') ON CONFLICT DO NOTHING;

-- fuel_receipt
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'fuel_receipt', '{
  "initial": "pending_review",
  "states": {
    "pending_review": { "label": "Pending Review",  "terminal": false, "color": "yellow" },
    "approved":       { "label": "Approved",         "terminal": false, "color": "green" },
    "rejected":       { "label": "Rejected",         "terminal": false, "color": "red" },
    "reconciled":     { "label": "Reconciled",       "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "pending_review", "to": "approved",   "label": "Approve",    "roles": ["owner", "admin"] },
    { "from": "pending_review", "to": "rejected",   "label": "Reject",     "roles": ["owner", "admin"] },
    { "from": "approved",       "to": "reconciled", "label": "Reconcile",  "roles": ["owner", "admin"] },
    { "from": "rejected",       "to": "pending_review", "label": "Resubmit" }
  ]
}') ON CONFLICT DO NOTHING;

-- maintenance_record
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'maintenance_record', '{
  "initial": "scheduled",
  "states": {
    "scheduled":   { "label": "Scheduled",   "terminal": false, "color": "gray" },
    "in_progress": { "label": "In Progress", "terminal": false, "color": "blue" },
    "completed":   { "label": "Completed",   "terminal": false, "color": "green" },
    "cancelled":   { "label": "Cancelled",   "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "scheduled",   "to": "in_progress", "label": "Start Service" },
    { "from": "in_progress", "to": "completed",   "label": "Complete Service" },
    { "from": "scheduled",   "to": "cancelled",   "label": "Cancel" },
    { "from": "in_progress", "to": "cancelled",   "label": "Cancel" }
  ]
}') ON CONFLICT DO NOTHING;

-- expense
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'expense', '{
  "initial": "draft",
  "states": {
    "draft":            { "label": "Draft",            "terminal": false, "color": "gray" },
    "pending_approval": { "label": "Pending Approval", "terminal": false, "color": "yellow" },
    "approved":         { "label": "Approved",         "terminal": false, "color": "green" },
    "rejected":         { "label": "Rejected",         "terminal": false, "color": "red" },
    "paid":             { "label": "Paid",             "terminal": true,  "color": "green" }
  },
  "transitions": [
    { "from": "draft",            "to": "pending_approval", "label": "Submit" },
    { "from": "pending_approval", "to": "approved",         "label": "Approve", "roles": ["owner", "admin"] },
    { "from": "pending_approval", "to": "rejected",         "label": "Reject",  "roles": ["owner", "admin"] },
    { "from": "approved",         "to": "paid",             "label": "Mark Paid", "roles": ["owner", "admin"] },
    { "from": "rejected",         "to": "draft",            "label": "Revise" }
  ]
}') ON CONFLICT DO NOTHING;

-- ── 3. contractor-pack identity row ──────────────────────────────────────────

INSERT INTO packs (
  id, display_name, description, author, version,
  icon, color, is_official, is_enabled, status, dependencies, installed_at
) VALUES (
  'lados.contractor-pack',
  'Contractor Edition',
  'Job, trip, fleet, and fuel management for civil and earth-works contractors',
  'Lados Platform',
  '0.1.0',
  'truck',
  '#F59E0B',
  true,
  true,
  'active',
  '["lados.foundation-pack"]'::jsonb,
  now()
) ON CONFLICT (id) DO UPDATE SET
  version     = EXCLUDED.version,
  description = EXCLUDED.description,
  status      = EXCLUDED.status,
  updated_at  = now();

-- ── 4. Register contractor-pack nodes ─────────────────────────────────────────

INSERT INTO registered_nodes (type, name, description, category, pack_id, icon, color, is_enabled, config_schema, inputs, outputs) VALUES

-- contractor.create_job
(
  'contractor.create_job',
  'Create Job',
  'Creates a new Job resource and optionally links it to a customer.',
  'contractor',
  'lados.contractor-pack',
  'briefcase',
  '#F59E0B',
  true,
  '{"type":"object","properties":{"title":{"type":"string","title":"Job Title"},"customerId":{"type":"string","title":"Customer ID (resource)"},"description":{"type":"string","title":"Description"},"scheduledDate":{"type":"string","title":"Scheduled Date (ISO)"},"projectId":{"type":"string","title":"Project ID"}},"required":["title"]}',
  '[{"name":"title","type":"string","required":true},{"name":"customerId","type":"string","required":false},{"name":"description","type":"string","required":false},{"name":"scheduledDate","type":"string","required":false}]',
  '[{"name":"jobId","type":"string"},{"name":"jobState","type":"string"}]'
),

-- contractor.dispatch_trip
(
  'contractor.dispatch_trip',
  'Dispatch Trip',
  'Creates a Trip resource under a Job and assigns a vehicle and driver.',
  'contractor',
  'lados.contractor-pack',
  'truck',
  '#3B82F6',
  true,
  '{"type":"object","properties":{"jobId":{"type":"string","title":"Job ID"},"vehicleId":{"type":"string","title":"Vehicle Resource ID"},"driverId":{"type":"string","title":"Driver Resource ID"},"scheduledDate":{"type":"string","title":"Scheduled Date (ISO)"},"notes":{"type":"string","title":"Notes"}},"required":["jobId","vehicleId","driverId"]}',
  '[{"name":"jobId","type":"string","required":true},{"name":"vehicleId","type":"string","required":true},{"name":"driverId","type":"string","required":true},{"name":"scheduledDate","type":"string","required":false},{"name":"notes","type":"string","required":false}]',
  '[{"name":"tripId","type":"string"},{"name":"tripState","type":"string"}]'
),

-- contractor.complete_trip
(
  'contractor.complete_trip',
  'Complete Trip',
  'Marks a Trip as completed and records odometer and notes.',
  'contractor',
  'lados.contractor-pack',
  'check-circle',
  '#10B981',
  true,
  '{"type":"object","properties":{"tripId":{"type":"string","title":"Trip ID"},"odometerEnd":{"type":"number","title":"Odometer End (km)"},"completedKm":{"type":"number","title":"Distance Completed (km)"},"notes":{"type":"string","title":"Completion Notes"}},"required":["tripId"]}',
  '[{"name":"tripId","type":"string","required":true},{"name":"odometerEnd","type":"number","required":false},{"name":"completedKm","type":"number","required":false},{"name":"notes","type":"string","required":false}]',
  '[{"name":"tripId","type":"string"},{"name":"tripState","type":"string"}]'
),

-- contractor.upload_fuel_receipt
(
  'contractor.upload_fuel_receipt',
  'Upload Fuel Receipt',
  'Creates a FuelReceipt resource and triggers AI extraction for human review. AI is advisory only — a human must approve the receipt.',
  'contractor',
  'lados.contractor-pack',
  'file-text',
  '#EF4444',
  true,
  '{"type":"object","properties":{"vehicleId":{"type":"string","title":"Vehicle Resource ID"},"fileUrl":{"type":"string","title":"Receipt File URL"},"amount":{"type":"number","title":"Amount (MYR)"},"liters":{"type":"number","title":"Litres"},"stationName":{"type":"string","title":"Station Name"}},"required":["vehicleId","fileUrl"]}',
  '[{"name":"vehicleId","type":"string","required":true},{"name":"fileUrl","type":"string","required":true},{"name":"amount","type":"number","required":false},{"name":"liters","type":"number","required":false},{"name":"stationName","type":"string","required":false}]',
  '[{"name":"receiptId","type":"string"},{"name":"receiptState","type":"string"}]'
),

-- contractor.generate_invoice
(
  'contractor.generate_invoice',
  'Generate Invoice',
  'Creates an Invoice resource from completed trips and/or equipment hours. Invoice moves to pending_approval — AI guardrail: invoice cannot be sent without human approval.',
  'contractor',
  'lados.contractor-pack',
  'file-plus',
  '#8B5CF6',
  true,
  '{"type":"object","properties":{"jobId":{"type":"string","title":"Job ID"},"customerId":{"type":"string","title":"Customer Resource ID"},"lineItems":{"type":"array","title":"Line Items (override auto-calculate)","items":{"type":"object"}},"notes":{"type":"string","title":"Notes"}},"required":["jobId"]}',
  '[{"name":"jobId","type":"string","required":true},{"name":"customerId","type":"string","required":false},{"name":"lineItems","type":"array","required":false},{"name":"notes","type":"string","required":false}]',
  '[{"name":"invoiceId","type":"string"},{"name":"invoiceState","type":"string"}]'
)

ON CONFLICT (type) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  pack_id     = EXCLUDED.pack_id,
  is_enabled  = EXCLUDED.is_enabled,
  updated_at  = now();
