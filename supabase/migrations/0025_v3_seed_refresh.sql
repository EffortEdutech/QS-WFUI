-- ── Migration 0025: V3 Seed Refresh ──────────────────────────────────────────
--
-- Brings all registered_nodes port definitions into sync with the actual
-- TypeScript real-node implementations, removes stub nodes that have no real
-- implementation, adds missing V3 AI Pack nodes, and replaces all workflow
-- templates with V3-compatible definitions whose node configs and port names
-- match the codebase exactly.
--
-- Safe to run on top of 0001–0024 (uses ON CONFLICT / DELETE / UPSERT only).
-- Sprint 19 (architecture alignment)
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1 — Remove obsolete / incompatible node seeds
-- ═══════════════════════════════════════════════════════════════════════════

-- ai.classifier  — generic stub, no real implementation, not in V3 spec
-- document.save_file — no real impl; project.save_artifact covers persistence
DELETE FROM registered_nodes
WHERE type IN ('ai.classifier', 'document.save_file');


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2 — Update existing node port definitions to match real implementations
-- ═══════════════════════════════════════════════════════════════════════════

-- ── core.manual_trigger ───────────────────────────────────────────────────
-- Source node. Outputs trigger_data (passthrough from run payload).
UPDATE registered_nodes SET
  outputs = '[
    {"id":"trigger_data","label":"Trigger Data","type":"json","description":"Run payload passed by the caller"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'core.manual_trigger';


-- ── core.human_approval ───────────────────────────────────────────────────
-- Real impl (core-human-approval.ts):
--   outputs: approved, rejected, comments, approval_task_id, approver_role
UPDATE registered_nodes SET
  inputs = '[
    {"id":"data","label":"Data to Review","type":"json","required":false,
     "description":"Snapshot of data presented to the approver"}
  ]'::jsonb,
  outputs = '[
    {"id":"approved",         "label":"Approved",          "type":"boolean"},
    {"id":"rejected",         "label":"Rejected",          "type":"boolean"},
    {"id":"comments",         "label":"Comments",          "type":"string"},
    {"id":"approval_task_id", "label":"Approval Task ID",  "type":"string"},
    {"id":"approver_role",    "label":"Approver Role",     "type":"string"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'core.human_approval';


-- ── core.logger ───────────────────────────────────────────────────────────
-- Real impl (core-logger.ts):
--   outputs: logged, message, level, logged_at
UPDATE registered_nodes SET
  outputs = '[
    {"id":"logged",    "label":"Logged",      "type":"boolean"},
    {"id":"message",   "label":"Message",     "type":"string"},
    {"id":"level",     "label":"Log Level",   "type":"string"},
    {"id":"logged_at", "label":"Logged At",   "type":"string"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'core.logger';


-- ── document.upload_file ──────────────────────────────────────────────────
-- UI-trigger node; execution runner treats it as a passthrough.
-- Outputs match what the canvas file-picker provides.
UPDATE registered_nodes SET
  outputs = '[
    {"id":"file_id",   "label":"File ID",   "type":"string",
     "description":"Upload record ID — pass to document.read_excel library_file_id config"},
    {"id":"file_name", "label":"File Name", "type":"string"},
    {"id":"mime_type", "label":"MIME Type", "type":"string"},
    {"id":"size_bytes","label":"Size (bytes)","type":"number"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'document.upload_file';


-- ── document.read_excel ───────────────────────────────────────────────────
-- Real impl (document-read-excel.ts):
--   inputs:  library_file_id (from config) or file_id (from upload node)
--   outputs: file_id, sheet_name, sheets, headers, row_count, rows
UPDATE registered_nodes SET
  inputs = '[
    {"id":"file_id","label":"File ID","type":"string","required":false,
     "description":"From document.upload_file — or set library_file_id in config"}
  ]'::jsonb,
  outputs = '[
    {"id":"file_id",    "label":"File ID",     "type":"string"},
    {"id":"sheet_name", "label":"Sheet Name",  "type":"string"},
    {"id":"sheets",     "label":"All Sheets",  "type":"array"},
    {"id":"headers",    "label":"Headers",     "type":"array"},
    {"id":"row_count",  "label":"Row Count",   "type":"number"},
    {"id":"rows",       "label":"Rows",        "type":"array",
     "description":"Array of row objects keyed by header name"}
  ]'::jsonb,
  config_schema = '[
    {"key":"library_file_id","label":"Library File ID","type":"string","required":false,
     "description":"ID of a file in the Project Library. Takes priority over the file_id input port."},
    {"key":"sheet_name",    "label":"Sheet Name",      "type":"string","required":false,
     "placeholder":"Sheet1",
     "description":"Name of the sheet to read. Defaults to the first sheet."},
    {"key":"header_row",    "label":"Header Row Number","type":"number","required":false,
     "defaultValue":1},
    {"key":"skip_empty",    "label":"Skip Empty Rows", "type":"boolean","required":false,
     "defaultValue":true}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'document.read_excel';


-- ── qs.read_boq ───────────────────────────────────────────────────────────
-- Real impl (qs-read-boq.ts):
--   inputs:  rows, headers (from read_excel), file_id
--   outputs: boq (BOQDocument), total_items, total_value, currency, sections
UPDATE registered_nodes SET
  inputs = '[
    {"id":"rows",    "label":"Rows",    "type":"array", "required":true,
     "description":"Row array from document.read_excel"},
    {"id":"headers", "label":"Headers", "type":"array", "required":false},
    {"id":"file_id", "label":"File ID", "type":"string","required":false}
  ]'::jsonb,
  outputs = '[
    {"id":"boq",         "label":"BOQ Document",  "type":"object",
     "description":"Structured BOQ with items, sections, totals"},
    {"id":"total_items", "label":"Total Items",   "type":"number"},
    {"id":"total_value", "label":"Total Value",   "type":"number"},
    {"id":"currency",    "label":"Currency",      "type":"string"},
    {"id":"sections",    "label":"Sections",      "type":"array"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'qs.read_boq';


-- ── qs.clean_boq ──────────────────────────────────────────────────────────
-- Real impl (qs-clean-boq.ts):
--   inputs:  boq, currency, sections
--   outputs: boq, clean_items, currency, sections, removed_count
UPDATE registered_nodes SET
  inputs = '[
    {"id":"boq",      "label":"BOQ Document","type":"object","required":true},
    {"id":"currency", "label":"Currency",    "type":"string","required":false},
    {"id":"sections", "label":"Sections",    "type":"array", "required":false}
  ]'::jsonb,
  outputs = '[
    {"id":"boq",           "label":"Cleaned BOQ",     "type":"object",
     "description":"BOQ with zero-qty and junk rows removed"},
    {"id":"clean_items",   "label":"Clean Items",     "type":"array"},
    {"id":"currency",      "label":"Currency",        "type":"string"},
    {"id":"sections",      "label":"Sections",        "type":"array"},
    {"id":"removed_count", "label":"Removed Count",   "type":"number"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'qs.clean_boq';


-- ── qs.classify_trade ─────────────────────────────────────────────────────
-- Real impl (qs-classify-trade.ts):
--   inputs:  boq (BOQDocument) — also accepts boq_items (flat array)
--   outputs: classified_items, trade_summary, currency, boq_id,
--            warnings, ai_used, item_count
UPDATE registered_nodes SET
  inputs = '[
    {"id":"boq",      "label":"BOQ Document","type":"object","required":false,
     "description":"Full BOQ from qs.read_boq or qs.clean_boq"},
    {"id":"boq_items","label":"BOQ Items",   "type":"array", "required":false,
     "description":"Flat item array — alternative to the boq port"}
  ]'::jsonb,
  outputs = '[
    {"id":"classified_items","label":"Classified Items", "type":"array",
     "description":"BOQ items with trade and confidence fields added"},
    {"id":"trade_summary",   "label":"Trade Summary",   "type":"object",
     "description":"Per-trade item counts and values"},
    {"id":"currency",        "label":"Currency",        "type":"string"},
    {"id":"boq_id",          "label":"BOQ ID",          "type":"string"},
    {"id":"warnings",        "label":"Warnings",        "type":"array"},
    {"id":"ai_used",         "label":"AI Used",         "type":"boolean"},
    {"id":"item_count",      "label":"Item Count",      "type":"number"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'qs.classify_trade';


-- ── qs.split_work_package ─────────────────────────────────────────────────
-- Real impl (qs-split-work-package.ts):
--   inputs:  classified_items, currency
--   outputs: work_packages, package_count, currency, grand_total
UPDATE registered_nodes SET
  inputs = '[
    {"id":"classified_items","label":"Classified Items","type":"array","required":true},
    {"id":"currency",        "label":"Currency",        "type":"string","required":false}
  ]'::jsonb,
  outputs = '[
    {"id":"work_packages",  "label":"Work Packages", "type":"array",
     "description":"One package per trade, each containing its line items"},
    {"id":"package_count",  "label":"Package Count", "type":"number"},
    {"id":"currency",       "label":"Currency",      "type":"string"},
    {"id":"grand_total",    "label":"Grand Total",   "type":"number"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'qs.split_work_package';


-- ── procurement.generate_rfq ──────────────────────────────────────────────
-- Real impl (procurement-generate-rfq.ts):
--   inputs:  work_packages, currency
--   outputs: documents (RfqArtifact[]), document_count, rfq_summary
UPDATE registered_nodes SET
  inputs = '[
    {"id":"work_packages","label":"Work Packages","type":"array", "required":true},
    {"id":"currency",     "label":"Currency",     "type":"string","required":false}
  ]'::jsonb,
  outputs = '[
    {"id":"documents",      "label":"RFQ Documents", "type":"array",
     "description":"Array of RfqArtifact objects with storage_path and signed URL"},
    {"id":"document_count", "label":"Document Count","type":"number"},
    {"id":"rfq_summary",    "label":"RFQ Summary",   "type":"object",
     "description":"Project name, closing date, package list"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'procurement.generate_rfq';


-- ── procurement.generate_po ───────────────────────────────────────────────
-- Real impl (procurement-generate-po.ts):
--   inputs:  supplier_name*, supplier_address, supplier_email,
--            supplier_reg_no, trade*, line_items, total_amount*, currency
--   outputs: documents (PoArtifact[]), po_reference, supplier,
--            total_amount, currency
UPDATE registered_nodes SET
  inputs = '[
    {"id":"supplier_name",   "label":"Supplier Name",    "type":"string","required":true},
    {"id":"supplier_address","label":"Supplier Address",  "type":"string","required":false},
    {"id":"supplier_email",  "label":"Supplier Email",   "type":"string","required":false},
    {"id":"supplier_reg_no", "label":"Reg No (SSM/ROC)", "type":"string","required":false},
    {"id":"trade",           "label":"Trade Package",    "type":"string","required":true},
    {"id":"line_items",      "label":"Line Items",       "type":"array", "required":false},
    {"id":"total_amount",    "label":"Contract Sum",     "type":"number","required":true},
    {"id":"currency",        "label":"Currency",         "type":"string","required":false}
  ]'::jsonb,
  outputs = '[
    {"id":"documents",    "label":"PO Documents",  "type":"array",
     "description":"Array of PoArtifact objects with signed DOCX URL"},
    {"id":"po_reference", "label":"PO Reference",  "type":"string"},
    {"id":"supplier",     "label":"Supplier Name", "type":"string"},
    {"id":"total_amount", "label":"Contract Sum",  "type":"number"},
    {"id":"currency",     "label":"Currency",      "type":"string"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'procurement.generate_po';


-- ── workflow.condition ────────────────────────────────────────────────────
-- Real impl (workflow-condition.ts):
--   inputs:  value (any)
--   outputs: true_path, false_path
UPDATE registered_nodes SET
  inputs = '[
    {"id":"value","label":"Value","type":"any","required":true,
     "description":"The value to evaluate against the condition expression"}
  ]'::jsonb,
  outputs = '[
    {"id":"true_path", "label":"True Path",  "type":"any",
     "description":"Carries the input value when condition is TRUE; null otherwise"},
    {"id":"false_path","label":"False Path", "type":"any",
     "description":"Carries the input value when condition is FALSE; null otherwise"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'workflow.condition';


-- ── project.save_artifact ─────────────────────────────────────────────────
-- Real impl (project-save-artifact.ts):
--   inputs:  value (any)
--   outputs: saved, artifact_key, saved_at, keys_saved
UPDATE registered_nodes SET
  inputs = '[
    {"id":"value","label":"Value to Save","type":"any","required":true,
     "description":"Any JSON-serialisable value to persist as a project artifact"}
  ]'::jsonb,
  outputs = '[
    {"id":"saved",        "label":"Saved",       "type":"boolean"},
    {"id":"artifact_key", "label":"Artifact Key","type":"string"},
    {"id":"saved_at",     "label":"Saved At",    "type":"string"},
    {"id":"keys_saved",   "label":"Keys Saved",  "type":"array"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'project.save_artifact';


-- ── project.read_artifact ─────────────────────────────────────────────────
-- Real impl (project-read-artifact.ts):
--   outputs: dynamic spread of artifact value + _artifact_key, _artifact_loaded_at,
--            _artifact_source_workflow
UPDATE registered_nodes SET
  outputs = '[
    {"id":"_artifact_key",             "label":"Artifact Key",      "type":"string"},
    {"id":"_artifact_loaded_at",       "label":"Loaded At",         "type":"string"},
    {"id":"_artifact_source_workflow", "label":"Source Workflow ID","type":"string"},
    {"id":"value",                     "label":"Artifact Value",    "type":"any",
     "description":"The saved artifact — all fields are also spread as individual outputs"}
  ]'::jsonb,
  updated_at = now()
WHERE type = 'project.read_artifact';


-- ── core.cron_trigger ─────────────────────────────────────────────────────
-- Already seeded correctly in 0024 — no change needed.


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3 — Insert missing V3 AI Pack nodes (stubs for future real impls)
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTE: These are registered stubs so the Skill Library shows the full V3 pack.
-- Real implementations are not yet wired — the runner will fall back to mock.
-- Mark: uses_services will be updated after insert.

INSERT INTO registered_nodes
  (type, pack_id, name, description, version, category, icon, color, tags,
   inputs, outputs, config_schema, ui_schema)
VALUES

(
  'ai.summarize_work_package',
  'lados.ai-pack',
  'Summarize Work Package',
  'Produces a concise natural-language summary of a work package for use in cover letters, client reports, or email notifications.',
  '1.0.0', 'ai', 'file-text', '#8B5CF6',
  ARRAY['ai', 'summary', 'work-package', 'nlp'],
  '[
    {"id":"work_package","label":"Work Package","type":"object","required":true,
     "description":"A single work package from qs.split_work_package"},
    {"id":"context",    "label":"Context",      "type":"string","required":false,
     "description":"Additional project context for the AI"}
  ]'::jsonb,
  '[
    {"id":"summary",       "label":"Summary Text",  "type":"string",
     "description":"Natural-language paragraph summary of the work package"},
    {"id":"bullet_points", "label":"Bullet Points", "type":"array",
     "description":"Key points as a string array"},
    {"id":"word_count",    "label":"Word Count",    "type":"number"}
  ]'::jsonb,
  '[
    {"key":"max_words",  "label":"Max Words",     "type":"number", "required":false,
     "defaultValue":150, "description":"Maximum summary length in words"},
    {"key":"tone",       "label":"Tone",          "type":"select", "required":false,
     "defaultValue":"professional",
     "options":[{"value":"professional","label":"Professional"},
                {"value":"technical",  "label":"Technical"},
                {"value":"concise",    "label":"Concise"}]},
    {"key":"language",   "label":"Language",      "type":"select", "required":false,
     "defaultValue":"en",
     "options":[{"value":"en","label":"English"},{"value":"ms","label":"Bahasa Malaysia"}]}
  ]'::jsonb,
  '{"title":"Summarize Work Package","category":"ai","color":"#8B5CF6",
    "description":"AI-generated natural-language summary of a work package."}'::jsonb
),

(
  'ai.detect_missing_data',
  'lados.ai-pack',
  'Detect Missing Data',
  'Scans BOQ items or structured data for missing quantities, rates, descriptions, or trade classifications and returns a report with remediation suggestions.',
  '1.0.0', 'ai', 'alert-triangle', '#8B5CF6',
  ARRAY['ai', 'validation', 'quality', 'boq', 'missing-data'],
  '[
    {"id":"boq",  "label":"BOQ Document","type":"object","required":false,
     "description":"BOQ from qs.read_boq — scans items for gaps"},
    {"id":"items","label":"Items Array", "type":"array", "required":false,
     "description":"Flat item array — alternative to the boq port"}
  ]'::jsonb,
  '[
    {"id":"issues",       "label":"Issues",        "type":"array",
     "description":"Array of {item, field, severity, suggestion} objects"},
    {"id":"issue_count",  "label":"Issue Count",   "type":"number"},
    {"id":"severity_high","label":"High Severity",  "type":"number",
     "description":"Count of high-severity issues (missing qty/rate)"},
    {"id":"clean",        "label":"Data is Clean", "type":"boolean",
     "description":"True when no issues found"}
  ]'::jsonb,
  '[
    {"key":"severity_threshold","label":"Report Severity","type":"select",
     "required":false,"defaultValue":"all",
     "options":[{"value":"all",  "label":"All issues"},
                {"value":"high", "label":"High severity only"}]},
    {"key":"check_trade","label":"Check Trade Classification","type":"boolean",
     "required":false,"defaultValue":true},
    {"key":"check_rates","label":"Check Missing Rates",      "type":"boolean",
     "required":false,"defaultValue":true},
    {"key":"check_desc", "label":"Check Empty Descriptions", "type":"boolean",
     "required":false,"defaultValue":true}
  ]'::jsonb,
  '{"title":"Detect Missing Data","category":"ai","color":"#8B5CF6",
    "description":"Scans BOQ data for gaps and quality issues."}'::jsonb
)

ON CONFLICT (type) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  pack_id       = EXCLUDED.pack_id,
  version       = EXCLUDED.version,
  inputs        = EXCLUDED.inputs,
  outputs       = EXCLUDED.outputs,
  config_schema = EXCLUDED.config_schema,
  ui_schema     = EXCLUDED.ui_schema,
  updated_at    = now();

-- Mark AI Pack stubs as requiring AI service
UPDATE registered_nodes SET
  uses_services  = ARRAY['ai-service'],
  data_pack_deps = ARRAY[]::text[]
WHERE type IN ('ai.summarize_work_package', 'ai.detect_missing_data');


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 4 — Replace workflow templates with V3-compatible definitions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 4a. BOQ-to-RFQ (revised) ──────────────────────────────────────────────
-- Real flow: manual_trigger → read_excel → read_boq → clean_boq
--          → classify_trade → split_work_package → generate_rfq
--          → human_approval → logger
--
-- Port connections are implicit: the runner maps outputs by name to inputs
-- by name when they share the same key (e.g. `boq`, `classified_items`).

INSERT INTO workflow_templates
  (slug, name, description, category, tags, icon, color, preview_nodes,
   sort_order, definition)
VALUES (
  'boq-to-rfq',
  'BOQ to RFQ',
  'Upload a Bill of Quantities Excel file, AI classifies trade items, splits into work packages, and generates professional RFQ DOCX documents ready for contractor submission.',
  'procurement',
  ARRAY['BOQ', 'RFQ', 'AI', 'Procurement', 'CIDB', 'QS'],
  'file-text',
  '#1E3A5F',
  ARRAY['Read Excel', 'Read BOQ', 'Clean BOQ', 'Classify Trade', 'Split Work Package', 'Generate RFQ', 'Human Approval'],
  10,
  '{
    "version": "1.0.0",
    "nodes": [
      {
        "id": "n-trigger",
        "type": "core.manual_trigger",
        "label": "Start",
        "position": {"x": 40, "y": 180},
        "config": {},
        "mode": "active"
      },
      {
        "id": "n-read-excel",
        "type": "document.read_excel",
        "label": "Read Excel BOQ",
        "position": {"x": 260, "y": 180},
        "config": {
          "library_file_id": "",
          "sheet_name": "BOQ",
          "header_row": 1,
          "skip_empty": true
        },
        "mode": "active"
      },
      {
        "id": "n-read-boq",
        "type": "qs.read_boq",
        "label": "Parse BOQ",
        "position": {"x": 480, "y": 180},
        "config": {
          "currency": "MYR"
        },
        "mode": "active"
      },
      {
        "id": "n-clean-boq",
        "type": "qs.clean_boq",
        "label": "Clean BOQ",
        "position": {"x": 700, "y": 180},
        "config": {
          "remove_zero_qty": true,
          "trim_descriptions": true
        },
        "mode": "active"
      },
      {
        "id": "n-classify",
        "type": "qs.classify_trade",
        "label": "Classify Trade",
        "position": {"x": 920, "y": 180},
        "config": {
          "classification_standard": "CIDB",
          "confidence_threshold": 0.6
        },
        "mode": "active"
      },
      {
        "id": "n-split",
        "type": "qs.split_work_package",
        "label": "Split Work Package",
        "position": {"x": 1140, "y": 180},
        "config": {
          "grouping_strategy": "by_trade",
          "max_items_per_package": 50
        },
        "mode": "active"
      },
      {
        "id": "n-rfq",
        "type": "procurement.generate_rfq",
        "label": "Generate RFQ",
        "position": {"x": 1360, "y": 180},
        "config": {
          "rfq_title": "Request for Quotation",
          "project_name": "",
          "due_date_days": 14,
          "max_packages": 10,
          "include_boq": true,
          "output_format": "docx"
        },
        "mode": "active"
      },
      {
        "id": "n-approval",
        "type": "core.human_approval",
        "label": "QS Review & Approve",
        "position": {"x": 1580, "y": 180},
        "config": {
          "title": "Review RFQ Documents Before Issuing to Contractors",
          "assignee_role": "owner",
          "description": "Verify trade classifications, quantities and pricing before RFQ dispatch."
        },
        "mode": "active"
      },
      {
        "id": "n-logger",
        "type": "core.logger",
        "label": "Log Completion",
        "position": {"x": 1800, "y": 180},
        "config": {
          "message": "BOQ-to-RFQ workflow completed. RFQ documents ready for dispatch.",
          "level": "info"
        },
        "mode": "active"
      }
    ],
    "edges": [
      {"id": "e1", "source": "n-trigger",     "target": "n-read-excel"},
      {"id": "e2", "source": "n-read-excel",  "target": "n-read-boq"},
      {"id": "e3", "source": "n-read-boq",    "target": "n-clean-boq"},
      {"id": "e4", "source": "n-clean-boq",   "target": "n-classify"},
      {"id": "e5", "source": "n-classify",    "target": "n-split"},
      {"id": "e6", "source": "n-split",       "target": "n-rfq"},
      {"id": "e7", "source": "n-rfq",         "target": "n-approval"},
      {"id": "e8", "source": "n-approval",    "target": "n-logger"}
    ],
    "variables": {},
    "metadata": {
      "name": "BOQ to RFQ",
      "description": "AI-assisted BOQ classification and RFQ generation.",
      "version": "3.0.0",
      "author": "QS-OS"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  tags          = EXCLUDED.tags,
  icon          = EXCLUDED.icon,
  color         = EXCLUDED.color,
  preview_nodes = EXCLUDED.preview_nodes,
  definition    = EXCLUDED.definition,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();


-- ── 4b. Tender Comparison ─────────────────────────────────────────────────
-- Flow: manual_trigger → classify_trade (re-run on quotes) → condition
--       (sufficient quotes?) → generate_po (award) → human_approval → logger
-- Simplified: represents the post-RFQ award decision stage.

INSERT INTO workflow_templates
  (slug, name, description, category, tags, icon, color, preview_nodes,
   sort_order, definition)
VALUES (
  'tender-comparison',
  'Tender Comparison & Award',
  'Compare contractor quotations received against RFQ work packages, apply a Condition to flag the lowest compliant tender, generate a Purchase Order for the selected supplier, and route for QS approval before award.',
  'procurement',
  ARRAY['Tender', 'Quotation', 'Award', 'PO', 'Procurement', 'QS'],
  'layout-template',
  '#059669',
  ARRAY['Read BOQ', 'Classify Trade', 'Split Work Package', 'Condition', 'Generate PO', 'Human Approval'],
  20,
  '{
    "version": "1.0.0",
    "nodes": [
      {
        "id": "n-trigger",
        "type": "core.manual_trigger",
        "label": "Start Tender Review",
        "position": {"x": 40, "y": 180},
        "config": {},
        "mode": "active"
      },
      {
        "id": "n-read-excel",
        "type": "document.read_excel",
        "label": "Read Quotation Excel",
        "position": {"x": 260, "y": 180},
        "config": {
          "library_file_id": "",
          "sheet_name": "Quotations",
          "header_row": 1,
          "skip_empty": true
        },
        "mode": "active"
      },
      {
        "id": "n-read-boq",
        "type": "qs.read_boq",
        "label": "Parse Quotation Data",
        "position": {"x": 480, "y": 180},
        "config": { "currency": "MYR" },
        "mode": "active"
      },
      {
        "id": "n-classify",
        "type": "qs.classify_trade",
        "label": "Classify by Trade",
        "position": {"x": 700, "y": 180},
        "config": {
          "classification_standard": "CIDB",
          "confidence_threshold": 0.6
        },
        "mode": "active"
      },
      {
        "id": "n-split",
        "type": "qs.split_work_package",
        "label": "Group by Package",
        "position": {"x": 920, "y": 180},
        "config": { "grouping_strategy": "by_trade" },
        "mode": "active"
      },
      {
        "id": "n-check-quotes",
        "type": "workflow.condition",
        "label": "Quotes Sufficient?",
        "position": {"x": 1140, "y": 180},
        "config": {
          "expression": "{{value}} >= 1",
          "true_label":  "Proceed to Award",
          "false_label": "Insufficient Quotes — Escalate"
        },
        "mode": "active"
      },
      {
        "id": "n-generate-po",
        "type": "procurement.generate_po",
        "label": "Generate Purchase Order",
        "position": {"x": 1360, "y": 100},
        "config": {
          "po_number_prefix": "PO",
          "payment_terms":    "30 days net",
          "delivery_terms":   "DDP Site",
          "project_name":     ""
        },
        "mode": "active"
      },
      {
        "id": "n-escalate",
        "type": "core.logger",
        "label": "Escalate — Seek More Quotes",
        "position": {"x": 1360, "y": 300},
        "config": {
          "message": "Insufficient quotations received. Manual follow-up required.",
          "level": "warn"
        },
        "mode": "active"
      },
      {
        "id": "n-approval",
        "type": "core.human_approval",
        "label": "QS Award Approval",
        "position": {"x": 1580, "y": 100},
        "config": {
          "title": "Approve Purchase Order Award",
          "assignee_role": "owner",
          "description": "AI is advisory only. A registered QS must review and approve this award decision."
        },
        "mode": "active"
      },
      {
        "id": "n-logger",
        "type": "core.logger",
        "label": "Log Award",
        "position": {"x": 1800, "y": 100},
        "config": {
          "message": "Tender comparison complete. PO issued and approved.",
          "level": "info"
        },
        "mode": "active"
      }
    ],
    "edges": [
      {"id": "e1", "source": "n-trigger",      "target": "n-read-excel"},
      {"id": "e2", "source": "n-read-excel",   "target": "n-read-boq"},
      {"id": "e3", "source": "n-read-boq",     "target": "n-classify"},
      {"id": "e4", "source": "n-classify",     "target": "n-split"},
      {"id": "e5", "source": "n-split",        "target": "n-check-quotes"},
      {"id": "e6", "source": "n-check-quotes", "target": "n-generate-po",
       "sourceHandle": "true_path"},
      {"id": "e7", "source": "n-check-quotes", "target": "n-escalate",
       "sourceHandle": "false_path"},
      {"id": "e8", "source": "n-generate-po",  "target": "n-approval"},
      {"id": "e9", "source": "n-approval",     "target": "n-logger"}
    ],
    "variables": {},
    "metadata": {
      "name": "Tender Comparison & Award",
      "description": "Compare quotes, condition-check, generate PO, approve award.",
      "version": "3.0.0",
      "author": "QS-OS"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  tags          = EXCLUDED.tags,
  icon          = EXCLUDED.icon,
  color         = EXCLUDED.color,
  preview_nodes = EXCLUDED.preview_nodes,
  definition    = EXCLUDED.definition,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();


-- ── 4c. Progress Claim Review ─────────────────────────────────────────────
-- Flow: cron_trigger (or manual) → read_excel (claim schedule)
--       → read_boq (parse claimed items) → classify_trade (verify trade)
--       → condition (amount within tolerance?) → human_approval → logger

INSERT INTO workflow_templates
  (slug, name, description, category, tags, icon, color, preview_nodes,
   sort_order, definition)
VALUES (
  'progress-claim-review',
  'Progress Claim Review',
  'Receive a contractor progress claim Excel, parse and classify claimed items against the contract BOQ, apply a tolerance check Condition, route to the QS for certification, and log the outcome for the audit trail.',
  'contract',
  ARRAY['Progress Claim', 'Certification', 'Contract', 'QS', 'CIPAA'],
  'zap',
  '#7C3AED',
  ARRAY['Cron Trigger', 'Read Excel', 'Read BOQ', 'Classify Trade', 'Condition', 'Human Approval'],
  30,
  '{
    "version": "1.0.0",
    "nodes": [
      {
        "id": "n-trigger",
        "type": "core.cron_trigger",
        "label": "Monthly Claim Check",
        "position": {"x": 40, "y": 180},
        "config": {
          "cron_expression": "0 9 1 * *",
          "timezone": "Asia/Kuala_Lumpur",
          "description": "Run on the 1st of every month at 09:00 MYT"
        },
        "mode": "active"
      },
      {
        "id": "n-read-excel",
        "type": "document.read_excel",
        "label": "Read Claim Schedule",
        "position": {"x": 260, "y": 180},
        "config": {
          "library_file_id": "",
          "sheet_name": "Progress Claim",
          "header_row": 1,
          "skip_empty": true
        },
        "mode": "active"
      },
      {
        "id": "n-read-boq",
        "type": "qs.read_boq",
        "label": "Parse Claimed Items",
        "position": {"x": 480, "y": 180},
        "config": { "currency": "MYR" },
        "mode": "active"
      },
      {
        "id": "n-classify",
        "type": "qs.classify_trade",
        "label": "Verify Trade Classification",
        "position": {"x": 700, "y": 180},
        "config": {
          "classification_standard": "CIDB",
          "confidence_threshold": 0.7
        },
        "mode": "active"
      },
      {
        "id": "n-check-amount",
        "type": "workflow.condition",
        "label": "Within Tolerance?",
        "position": {"x": 920, "y": 180},
        "config": {
          "expression": "{{value}} <= 1000000",
          "true_label":  "Certify — Within Limit",
          "false_label": "Escalate — Exceeds Threshold"
        },
        "mode": "active"
      },
      {
        "id": "n-certify",
        "type": "core.human_approval",
        "label": "QS Certification",
        "position": {"x": 1140, "y": 100},
        "config": {
          "title": "Certify Progress Claim",
          "assignee_role": "owner",
          "description": "AI is advisory only. A registered QS must certify this progress claim under CIPAA 2012."
        },
        "mode": "active"
      },
      {
        "id": "n-escalate",
        "type": "core.human_approval",
        "label": "Senior Review — High Value",
        "position": {"x": 1140, "y": 300},
        "config": {
          "title": "High-Value Claim Requires Senior QS Review",
          "assignee_role": "admin",
          "description": "Claim exceeds MYR 1,000,000 threshold. Senior QS or client representative must review."
        },
        "mode": "active"
      },
      {
        "id": "n-save",
        "type": "project.save_artifact",
        "label": "Save Certification Record",
        "position": {"x": 1360, "y": 180},
        "config": {
          "artifact_key": "progress_claim_certification"
        },
        "mode": "active"
      },
      {
        "id": "n-logger",
        "type": "core.logger",
        "label": "Log Certification",
        "position": {"x": 1580, "y": 180},
        "config": {
          "message": "Progress claim review complete. Certification recorded.",
          "level": "info"
        },
        "mode": "active"
      }
    ],
    "edges": [
      {"id": "e1", "source": "n-trigger",      "target": "n-read-excel"},
      {"id": "e2", "source": "n-read-excel",   "target": "n-read-boq"},
      {"id": "e3", "source": "n-read-boq",     "target": "n-classify"},
      {"id": "e4", "source": "n-classify",     "target": "n-check-amount"},
      {"id": "e5", "source": "n-check-amount", "target": "n-certify",
       "sourceHandle": "true_path"},
      {"id": "e6", "source": "n-check-amount", "target": "n-escalate",
       "sourceHandle": "false_path"},
      {"id": "e7", "source": "n-certify",      "target": "n-save"},
      {"id": "e8", "source": "n-escalate",     "target": "n-save"},
      {"id": "e9", "source": "n-save",         "target": "n-logger"}
    ],
    "variables": {},
    "metadata": {
      "name": "Progress Claim Review",
      "description": "Monthly claim parsing, QS tolerance check, and certification under CIPAA 2012.",
      "version": "3.0.0",
      "author": "QS-OS"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  tags          = EXCLUDED.tags,
  icon          = EXCLUDED.icon,
  color         = EXCLUDED.color,
  preview_nodes = EXCLUDED.preview_nodes,
  definition    = EXCLUDED.definition,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();
