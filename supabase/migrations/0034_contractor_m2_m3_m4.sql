-- =============================================================================
-- Migration 0034 — Contractor Edition M2 / M3 / M4
--
-- M2 Finance:       payment state machine + record_payment, approve_expense nodes
-- M3 Fleet Maint.:  operator resource type + state machine; create_maintenance_record, clear_maintenance nodes
-- M4 HR / Payroll:  payroll_run resource type + state machine; prepare_payroll_run, approve_payroll nodes
--
-- NOTE: payment, maintenance_record, expense are already in the lados_resources.type
--       CHECK constraint (added in 0032). Only operator + payroll_run are new.
-- =============================================================================

-- ── 1. Expand type CHECK — add operator + payroll_run ─────────────────────────

ALTER TABLE lados_resources
  DROP CONSTRAINT IF EXISTS lados_resources_type_check;

ALTER TABLE lados_resources
  ADD CONSTRAINT lados_resources_type_check
  CHECK (type IN (
    -- original core types (Phase 3)
    'job', 'fleet', 'worker', 'material', 'site',
    -- Phase 5
    'trip', 'invoice', 'payment',
    -- Phase 9 — Contractor Edition M1
    'customer', 'driver', 'vehicle', 'equipment',
    'fuel_receipt', 'maintenance_record', 'expense',
    -- Phase 9 — Contractor Edition M3 (operator) + M4 (payroll_run)
    'operator', 'payroll_run',
    -- escape hatch
    'custom'
  ));

-- ── 2. State machines ─────────────────────────────────────────────────────────

-- payment  (M2)
-- States: pending → recorded → reconciled → archived
-- Guardrail: payment is recorded by human. System never initiates bank transfer.
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'payment', '{
  "initial": "pending",
  "states": {
    "pending":    { "label": "Pending",    "terminal": false, "color": "yellow" },
    "recorded":   { "label": "Recorded",   "terminal": false, "color": "blue" },
    "reconciled": { "label": "Reconciled", "terminal": false, "color": "green" },
    "disputed":   { "label": "Disputed",   "terminal": false, "color": "red" },
    "archived":   { "label": "Archived",   "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "pending",    "to": "recorded",   "label": "Record Payment",  "roles": ["owner", "admin"] },
    { "from": "recorded",   "to": "reconciled", "label": "Reconcile",       "roles": ["owner", "admin"] },
    { "from": "recorded",   "to": "disputed",   "label": "Raise Dispute",   "roles": ["owner", "admin"] },
    { "from": "disputed",   "to": "recorded",   "label": "Resolve Dispute", "roles": ["owner", "admin"] },
    { "from": "reconciled", "to": "archived",   "label": "Archive",         "roles": ["owner", "admin"] }
  ]
}') ON CONFLICT DO NOTHING;

-- operator  (M3)
-- Equipment operators (backhoe, roller, grader drivers) — parallel role to driver
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'operator', '{
  "initial": "available",
  "states": {
    "available":  { "label": "Available",  "terminal": false, "color": "green" },
    "on_site":    { "label": "On Site",    "terminal": false, "color": "blue" },
    "on_leave":   { "label": "On Leave",   "terminal": false, "color": "yellow" },
    "suspended":  { "label": "Suspended",  "terminal": false, "color": "red" },
    "inactive":   { "label": "Inactive",   "terminal": true,  "color": "gray" }
  },
  "transitions": [
    { "from": "available", "to": "on_site",   "label": "Deploy to Site" },
    { "from": "on_site",   "to": "available", "label": "Return from Site" },
    { "from": "available", "to": "on_leave",  "label": "Start Leave" },
    { "from": "on_leave",  "to": "available", "label": "Return from Leave" },
    { "from": "available", "to": "suspended", "label": "Suspend" },
    { "from": "suspended", "to": "available", "label": "Reinstate" },
    { "from": "available", "to": "inactive",  "label": "Deactivate" }
  ]
}') ON CONFLICT DO NOTHING;

-- payroll_run  (M4)
-- Guardrail: system cannot mark payroll as paid. Owner initiates bank transfer
-- and then manually marks as paid in the system.
INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'payroll_run', '{
  "initial": "draft",
  "states": {
    "draft":            { "label": "Draft",            "terminal": false, "color": "gray" },
    "pending_review":   { "label": "Pending Review",   "terminal": false, "color": "yellow" },
    "approved":         { "label": "Approved",         "terminal": false, "color": "green" },
    "paid":             { "label": "Paid",             "terminal": true,  "color": "green" },
    "voided":           { "label": "Voided",           "terminal": true,  "color": "red" }
  },
  "transitions": [
    { "from": "draft",          "to": "pending_review", "label": "Submit for Review" },
    { "from": "pending_review", "to": "approved",       "label": "Approve",   "roles": ["owner", "admin"] },
    { "from": "pending_review", "to": "draft",          "label": "Return for Revision" },
    { "from": "approved",       "to": "paid",           "label": "Mark as Paid", "roles": ["owner", "admin"] },
    { "from": "draft",          "to": "voided",         "label": "Void",      "roles": ["owner", "admin"] },
    { "from": "pending_review", "to": "voided",         "label": "Void",      "roles": ["owner", "admin"] }
  ]
}') ON CONFLICT DO NOTHING;

-- ── 3. Register new nodes in registered_nodes ─────────────────────────────────

INSERT INTO registered_nodes (
  type, name, description, category, pack_id, icon, color,
  is_enabled, config_schema, inputs, outputs
) VALUES

-- contractor.record_payment  (M2)
(
  'contractor.record_payment',
  'Record Payment',
  'Records a payment received against an invoice. Transitions the Invoice to pending_reconciliation and creates a Payment resource. Owner must confirm — system never initiates bank transfer.',
  'contractor',
  'lados.contractor-pack',
  'credit-card',
  '#10B981',
  true,
  '{"type":"object","properties":{"invoiceId":{"type":"string","title":"Invoice Resource ID"},"amount":{"type":"number","title":"Amount Received (MYR)"},"method":{"type":"string","title":"Payment Method","enum":["bank_transfer","cash","cheque","online"]},"reference":{"type":"string","title":"Bank / Cheque Reference"},"notes":{"type":"string","title":"Notes"}},"required":["invoiceId","amount"]}',
  '[{"name":"invoiceId","type":"string","required":true},{"name":"amount","type":"number","required":true},{"name":"method","type":"string","required":false},{"name":"reference","type":"string","required":false},{"name":"notes","type":"string","required":false}]',
  '[{"name":"paymentId","type":"string"},{"name":"paymentState","type":"string"},{"name":"invoiceState","type":"string"}]'
),

-- contractor.approve_expense  (M2)
(
  'contractor.approve_expense',
  'Approve Expense',
  'Transitions an Expense resource to approved. AI guardrail: this node must be called by an owner/admin user — AI cannot approve expenses.',
  'contractor',
  'lados.contractor-pack',
  'check-square',
  '#6366F1',
  true,
  '{"type":"object","properties":{"expenseId":{"type":"string","title":"Expense Resource ID"},"notes":{"type":"string","title":"Approval Notes"}},"required":["expenseId"]}',
  '[{"name":"expenseId","type":"string","required":true},{"name":"notes","type":"string","required":false}]',
  '[{"name":"expenseId","type":"string"},{"name":"expenseState","type":"string"}]'
),

-- contractor.create_maintenance_record  (M3)
(
  'contractor.create_maintenance_record',
  'Create Maintenance Record',
  'Creates a MaintenanceRecord resource linked to a vehicle or equipment and transitions the asset to maintenance state.',
  'contractor',
  'lados.contractor-pack',
  'tool',
  '#F59E0B',
  true,
  '{"type":"object","properties":{"assetId":{"type":"string","title":"Vehicle or Equipment Resource ID"},"assetType":{"type":"string","title":"Asset Type","enum":["vehicle","equipment"]},"description":{"type":"string","title":"Work Description"},"scheduledDate":{"type":"string","title":"Scheduled Date (ISO)"},"workshop":{"type":"string","title":"Workshop / Vendor"}},"required":["assetId","assetType","description"]}',
  '[{"name":"assetId","type":"string","required":true},{"name":"assetType","type":"string","required":true},{"name":"description","type":"string","required":true},{"name":"scheduledDate","type":"string","required":false},{"name":"workshop","type":"string","required":false}]',
  '[{"name":"maintenanceRecordId","type":"string"},{"name":"maintenanceState","type":"string"},{"name":"assetState","type":"string"}]'
),

-- contractor.clear_maintenance  (M3)
(
  'contractor.clear_maintenance',
  'Clear Maintenance',
  'Marks a MaintenanceRecord as completed and transitions the linked vehicle or equipment back to available.',
  'contractor',
  'lados.contractor-pack',
  'check-circle',
  '#10B981',
  true,
  '{"type":"object","properties":{"maintenanceRecordId":{"type":"string","title":"Maintenance Record ID"},"completionNotes":{"type":"string","title":"Completion Notes"},"cost":{"type":"number","title":"Service Cost (MYR)"}},"required":["maintenanceRecordId"]}',
  '[{"name":"maintenanceRecordId","type":"string","required":true},{"name":"completionNotes","type":"string","required":false},{"name":"cost","type":"number","required":false}]',
  '[{"name":"maintenanceRecordId","type":"string"},{"name":"maintenanceState","type":"string"},{"name":"assetId","type":"string"},{"name":"assetState","type":"string"}]'
),

-- contractor.prepare_payroll_run  (M4)
(
  'contractor.prepare_payroll_run',
  'Prepare Payroll Run',
  'Creates a PayrollRun resource for a pay period, computes gross pay per employee from rate × days, and submits for owner review.',
  'contractor',
  'lados.contractor-pack',
  'users',
  '#8B5CF6',
  true,
  '{"type":"object","properties":{"periodStart":{"type":"string","title":"Period Start (ISO date)"},"periodEnd":{"type":"string","title":"Period End (ISO date)"},"employees":{"type":"array","title":"Employees","items":{"type":"object","properties":{"employeeId":{"type":"string"},"name":{"type":"string"},"dailyRate":{"type":"number"},"daysWorked":{"type":"number"}},"required":["employeeId","dailyRate","daysWorked"]}},"notes":{"type":"string","title":"Notes"}},"required":["periodStart","periodEnd","employees"]}',
  '[{"name":"periodStart","type":"string","required":true},{"name":"periodEnd","type":"string","required":true},{"name":"employees","type":"array","required":true},{"name":"notes","type":"string","required":false}]',
  '[{"name":"payrollRunId","type":"string"},{"name":"payrollRunState","type":"string"},{"name":"totalGross","type":"number"},{"name":"employeeCount","type":"number"}]'
),

-- contractor.approve_payroll  (M4)
(
  'contractor.approve_payroll',
  'Approve Payroll',
  'Transitions a PayrollRun to approved. AI guardrail: only owner/admin may approve payroll. System never initiates salary transfer — owner must perform bank transfer independently.',
  'contractor',
  'lados.contractor-pack',
  'shield-check',
  '#DC2626',
  true,
  '{"type":"object","properties":{"payrollRunId":{"type":"string","title":"Payroll Run ID"},"notes":{"type":"string","title":"Approval Notes"}},"required":["payrollRunId"]}',
  '[{"name":"payrollRunId","type":"string","required":true},{"name":"notes","type":"string","required":false}]',
  '[{"name":"payrollRunId","type":"string"},{"name":"payrollRunState","type":"string"}]'
)

ON CONFLICT (type) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  pack_id     = EXCLUDED.pack_id,
  is_enabled  = EXCLUDED.is_enabled,
  updated_at  = now();

-- ── 4. Bump contractor-pack version ──────────────────────────────────────────

UPDATE packs
SET
  version    = '0.3.0',
  updated_at = now()
WHERE id = 'lados.contractor-pack';
