-- ============================================================
-- Seed: Sample Workflow — "BOQ to RFQ" for Hospital B project
-- Project ID  : e1e76bae-5020-456a-aa39-13aca8383961
-- Created by  : 04a7e838-0f05-4d12-a5cf-e96b59bc8eb5
-- Run in      : Supabase SQL Editor (project fsrdasrwceuscrfglskd)
-- ============================================================
--
-- Workflow DAG (linear chain):
--
--   [Manual Trigger]
--        ↓
--   [Upload BOQ File]       (document.upload_file)
--        ↓
--   [Read Excel]            (document.read_excel)
--        ↓
--   [Parse BOQ]             (qs.read_boq)
--        ↓
--   [Clean BOQ]             (qs.clean_boq)
--        ↓
--   [Classify Trades]       (qs.classify_trade)
--        ↓
--   [Split Work Packages]   (qs.split_work_package)
--        ↓
--   [Generate RFQ Docs]     (procurement.generate_rfq)
--        ↓
--   [Log Completion]        (core.logger)
--
-- This exercises ALL 5 packs in a realistic QS scenario.
-- ============================================================

INSERT INTO workflows (
  id,
  project_id,
  name,
  description,
  status,
  version,
  tags,
  definition,
  created_by
)
VALUES (
  gen_random_uuid(),
  'e1e76bae-5020-456a-aa39-13aca8383961',
  'Hospital B — BOQ to RFQ (Sample)',
  'End-to-end QS workflow: uploads a BOQ Excel file, parses and cleans it, classifies trades, splits into work packages, and generates RFQ documents for each trade package.',
  'draft',
  '1.0.0',
  ARRAY['boq', 'rfq', 'hospital', 'sample'],
  '{
    "schemaVersion": "1.0",
    "workflow": {
      "id": "wf-sample-hospital-b",
      "name": "Hospital B — BOQ to RFQ (Sample)",
      "description": "Upload BOQ → Parse → Clean → Classify → Split → RFQ",
      "version": "1.0.0",
      "status": "draft",
      "tags": ["boq", "rfq", "hospital", "sample"],
      "createdAt": "2026-06-16T00:00:00.000Z",
      "updatedAt": "2026-06-16T00:00:00.000Z"
    },
    "nodes": [
      {
        "id": "n-1",
        "type": "core.manual_trigger",
        "label": "Start",
        "position": { "x": 250, "y": 50 },
        "config": {}
      },
      {
        "id": "n-2",
        "type": "document.upload_file",
        "label": "Upload BOQ Excel",
        "position": { "x": 250, "y": 180 },
        "config": {
          "allowed_types": ["xlsx", "xls"],
          "max_size_mb": 10,
          "description": "Upload the Hospital B Bill of Quantities"
        }
      },
      {
        "id": "n-3",
        "type": "document.read_excel",
        "label": "Read Excel Rows",
        "position": { "x": 250, "y": 310 },
        "config": {
          "sheet_name": "BOQ",
          "header_row": 1,
          "skip_empty": true
        }
      },
      {
        "id": "n-4",
        "type": "qs.read_boq",
        "label": "Parse BOQ",
        "position": { "x": 250, "y": 440 },
        "config": {
          "currency": "MYR",
          "item_col": "A",
          "desc_col": "B",
          "unit_col": "C",
          "qty_col": "D",
          "rate_col": "E",
          "amount_col": "F"
        }
      },
      {
        "id": "n-5",
        "type": "qs.clean_boq",
        "label": "Clean & Validate BOQ",
        "position": { "x": 250, "y": 570 },
        "config": {
          "fix_missing_units": true,
          "fix_duplicates": true,
          "flag_zero_rates": true
        }
      },
      {
        "id": "n-6",
        "type": "qs.classify_trade",
        "label": "Classify Trades",
        "position": { "x": 250, "y": 700 },
        "config": {
          "model": "auto",
          "confidence_threshold": 0.80,
          "trades": ["Civil", "Structural", "Mechanical", "Electrical", "Finishing", "External Works"]
        }
      },
      {
        "id": "n-7",
        "type": "qs.split_work_package",
        "label": "Split Work Packages",
        "position": { "x": 250, "y": 830 },
        "config": {
          "split_by": "trade",
          "min_package_value": 50000
        }
      },
      {
        "id": "n-8",
        "type": "procurement.generate_rfq",
        "label": "Generate RFQ Documents",
        "position": { "x": 250, "y": 960 },
        "config": {
          "project_name": "Hospital B",
          "project_code": "PRJ-001",
          "currency": "MYR",
          "rfq_template": "standard",
          "closing_days": 14,
          "contact_name": "QS Manager",
          "contact_email": "qs@hospitalb.com"
        }
      },
      {
        "id": "n-9",
        "type": "core.logger",
        "label": "Log Completion",
        "position": { "x": 250, "y": 1090 },
        "config": {
          "message": "BOQ to RFQ workflow completed for Hospital B. Check procurement/rfq/ for generated documents.",
          "level": "info"
        }
      }
    ],
    "connections": [
      {
        "id": "c-1-2",
        "sourceNodeId": "n-1",
        "sourcePortId": "output",
        "targetNodeId": "n-2",
        "targetPortId": "input"
      },
      {
        "id": "c-2-3",
        "sourceNodeId": "n-2",
        "sourcePortId": "file",
        "targetNodeId": "n-3",
        "targetPortId": "file_id"
      },
      {
        "id": "c-3-4",
        "sourceNodeId": "n-3",
        "sourcePortId": "rows",
        "targetNodeId": "n-4",
        "targetPortId": "rows"
      },
      {
        "id": "c-4-5",
        "sourceNodeId": "n-4",
        "sourcePortId": "boq",
        "targetNodeId": "n-5",
        "targetPortId": "boq"
      },
      {
        "id": "c-5-6",
        "sourceNodeId": "n-5",
        "sourcePortId": "boq",
        "targetNodeId": "n-6",
        "targetPortId": "boq"
      },
      {
        "id": "c-6-7",
        "sourceNodeId": "n-6",
        "sourcePortId": "boq",
        "targetNodeId": "n-7",
        "targetPortId": "boq"
      },
      {
        "id": "c-7-8",
        "sourceNodeId": "n-7",
        "sourcePortId": "work_packages",
        "targetNodeId": "n-8",
        "targetPortId": "work_packages"
      },
      {
        "id": "c-8-9",
        "sourceNodeId": "n-8",
        "sourcePortId": "rfqs",
        "targetNodeId": "n-9",
        "targetPortId": "input"
      }
    ],
    "variables": [
      {
        "name": "project_name",
        "type": "string",
        "defaultValue": "Hospital B",
        "description": "Project display name"
      },
      {
        "name": "project_code",
        "type": "string",
        "defaultValue": "PRJ-001",
        "description": "Project code for RFQ numbering"
      }
    ],
    "metadata": {
      "author": "QS-OS Seed",
      "purpose": "Sprint 6 end-to-end test workflow"
    }
  }',
  '04a7e838-0f05-4d12-a5cf-e96b59bc8eb5'
)
ON CONFLICT DO NOTHING;

-- Verify it was inserted
SELECT
  id,
  name,
  status,
  version,
  tags,
  jsonb_array_length(definition->'nodes')   AS node_count,
  jsonb_array_length(definition->'connections') AS connection_count
FROM workflows
WHERE project_id = 'e1e76bae-5020-456a-aa39-13aca8383961';
