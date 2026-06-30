-- ── Migration 0022: Register procurement.generate_po node ────────────────────
--
-- Adds the Purchase Order generation node to registered_nodes.
-- Follows the same pattern as procurement.generate_rfq (migration 0005 + 0009).
--
-- Sprint 17 (S17-006)

INSERT INTO registered_nodes (
  type,
  pack_id,
  name,
  description,
  version,
  category,
  icon,
  color,
  tags,
  inputs,
  outputs,
  config_schema,
  ui_schema
)
VALUES (
  'procurement.generate_po',
  'lados.procurement-pack',
  'Generate PO',
  'Generates a Purchase Order DOCX for an awarded supplier, uploads to Storage, and returns a signed download URL. DRAFT — must be reviewed and signed by an authorized officer before it constitutes a binding commitment.',
  '1.0.0',
  'procurement',
  'file-check',
  '#10B981',
  ARRAY['po', 'purchase-order', 'procurement', 'award', 'contract'],
  '[
    {"id":"supplier_name",    "label":"Supplier Name",    "type":"string",  "required":true},
    {"id":"supplier_address", "label":"Supplier Address", "type":"string",  "required":false},
    {"id":"supplier_email",   "label":"Supplier Email",   "type":"string",  "required":false},
    {"id":"supplier_reg_no",  "label":"Supplier Reg No",  "type":"string",  "required":false},
    {"id":"trade",            "label":"Trade Package",    "type":"string",  "required":true},
    {"id":"line_items",       "label":"Line Items",       "type":"array",   "required":false},
    {"id":"total_amount",     "label":"Contract Sum",     "type":"number",  "required":true},
    {"id":"currency",         "label":"Currency",         "type":"string",  "required":false}
  ]'::jsonb,
  '[
    {"id":"documents",    "label":"PO Documents",   "type":"array"},
    {"id":"po_reference", "label":"PO Reference",   "type":"string"},
    {"id":"total_amount", "label":"Contract Sum",   "type":"number"},
    {"id":"currency",     "label":"Currency",       "type":"string"}
  ]'::jsonb,
  '[
    {"key":"project_name",      "label":"Project Name",        "type":"string",  "required":false,
     "placeholder":"Hospital B — New Wing Construction"},
    {"key":"po_number_prefix",  "label":"PO Number Prefix",    "type":"string",  "required":false,
     "defaultValue":"PO",
     "description":"e.g. PO, CONTRACT, AWARD — will be prefixed to the auto-generated PO number."},
    {"key":"payment_terms",     "label":"Payment Terms",       "type":"string",  "required":false,
     "defaultValue":"30 days net",
     "placeholder":"30 days net / Progress payment"},
    {"key":"delivery_terms",    "label":"Delivery / Commencement Terms","type":"string","required":false,
     "defaultValue":"DDP Site",
     "placeholder":"DDP Site / FOB Port Klang"},
    {"key":"authorized_by",     "label":"Authorized By (Name)","type":"string",  "required":false,
     "placeholder":"Name of signing officer — leave blank for manual entry",
     "description":"Printed in the Employer signature block. This is a DRAFT — physical signature required."}
  ]'::jsonb,
  '{"title":"Generate PO","category":"procurement","color":"#10B981","description":"Generates a draft Purchase Order DOCX for human review and signing."}'::jsonb
)
ON CONFLICT (type) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  pack_id      = EXCLUDED.pack_id,
  version      = EXCLUDED.version,
  category     = EXCLUDED.category,
  icon         = EXCLUDED.icon,
  color        = EXCLUDED.color,
  tags         = EXCLUDED.tags,
  inputs       = EXCLUDED.inputs,
  outputs      = EXCLUDED.outputs,
  config_schema= EXCLUDED.config_schema,
  ui_schema    = EXCLUDED.ui_schema,
  updated_at   = now();

-- ── Service metadata (for Skill Inspector badges) ──────────────────────────────

UPDATE registered_nodes SET
  uses_services  = ARRAY['storage-service', 'audit-service'],
  data_pack_deps = ARRAY[]::text[]
WHERE type = 'procurement.generate_po';
