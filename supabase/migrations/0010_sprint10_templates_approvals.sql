-- ============================================================
-- Migration 0010: Workflow Templates + Approval Tasks + Audit Log
-- Sprint 10 (S10-001 · S10-002 · S10-005)
-- ============================================================

-- ── 1. Workflow Templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT 'general',
  tags          text[] NOT NULL DEFAULT '{}',
  icon          text NOT NULL DEFAULT 'layout-template',
  color         text NOT NULL DEFAULT '#1E3A5F',
  definition    jsonb NOT NULL,          -- QSWorkflowDefinition to instantiate
  preview_nodes text[] NOT NULL DEFAULT '{}',  -- node type labels for preview
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Approval Tasks ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  uuid NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  workflow_id   uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id       text NOT NULL,
  node_name     text NOT NULL,
  title         text NOT NULL,
  description   text,
  data          jsonb,                   -- snapshot of data passed to approval node
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','auto_approved')),
  assignee_role text NOT NULL DEFAULT 'owner',
  decided_by    uuid REFERENCES auth.users(id),
  decision_at   timestamptz,
  comments      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_tasks_execution_id_idx ON approval_tasks(execution_id);
CREATE INDEX IF NOT EXISTS approval_tasks_project_id_status_idx ON approval_tasks(project_id, status);

-- ── 3. Audit Log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      text NOT NULL,   -- workflow.created, run.started, run.completed, etc.
  entity_type     text,            -- 'workflow', 'run', 'document', 'pack'
  entity_id       uuid,
  summary         text NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_org_id_idx ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS audit_log_project_id_idx ON audit_log(project_id);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

-- ── 4. Seed: BOQ-to-RFQ Workflow Template ───────────────────────────────────

INSERT INTO workflow_templates
  (slug, name, description, category, tags, icon, color, preview_nodes, sort_order, definition)
VALUES (
  'boq-to-rfq',
  'BOQ to RFQ',
  'Upload a Bill of Quantities Excel file, let AI classify items by trade, split into work packages, and generate professional RFQ documents ready for contractor submission.',
  'procurement',
  ARRAY['BOQ', 'RFQ', 'AI', 'Procurement', 'CIDB'],
  'file-text',
  '#1E3A5F',
  ARRAY['Manual Trigger', 'Read BOQ', 'Clean BOQ', 'AI Classify Trade', 'Split Work Package', 'Generate RFQ', 'Human Approval', 'Logger'],
  10,
  '{
    "version": "1.0.0",
    "nodes": [
      {
        "id": "node-trigger",
        "type": "core.manual_trigger",
        "label": "Start",
        "position": {"x": 60, "y": 200},
        "config": {},
        "inputs": [],
        "outputs": ["trigger_data"]
      },
      {
        "id": "node-read-boq",
        "type": "qs.read_boq",
        "label": "Read BOQ",
        "position": {"x": 280, "y": 200},
        "config": {
          "currency": "MYR"
        },
        "inputs": ["file_url", "library_file_id"],
        "outputs": ["boq", "currency", "sections", "total_items"]
      },
      {
        "id": "node-clean-boq",
        "type": "qs.clean_boq",
        "label": "Clean BOQ",
        "position": {"x": 500, "y": 200},
        "config": {
          "remove_zero_qty": true,
          "trim_descriptions": true
        },
        "inputs": ["boq"],
        "outputs": ["boq", "clean_items", "removed_count"]
      },
      {
        "id": "node-classify",
        "type": "qs.classify_trade",
        "label": "AI Classify Trade",
        "position": {"x": 720, "y": 200},
        "config": {
          "use_ai": true,
          "confidence_threshold": 0.6
        },
        "inputs": ["boq"],
        "outputs": ["classified_items", "trade_summary", "ai_used"]
      },
      {
        "id": "node-split",
        "type": "qs.split_work_package",
        "label": "Split Work Package",
        "position": {"x": 940, "y": 200},
        "config": {
          "max_items_per_package": 50
        },
        "inputs": ["classified_items", "currency"],
        "outputs": ["work_packages", "package_count", "grand_total"]
      },
      {
        "id": "node-generate-rfq",
        "type": "procurement.generate_rfq",
        "label": "Generate RFQ",
        "position": {"x": 1160, "y": 200},
        "config": {
          "rfq_title": "Request for Quotation",
          "project_name": "Project",
          "due_date_days": 14,
          "max_packages": 5,
          "include_boq": true
        },
        "inputs": ["work_packages", "currency"],
        "outputs": ["documents", "document_count"]
      },
      {
        "id": "node-approval",
        "type": "core.human_approval",
        "label": "Review & Approve",
        "position": {"x": 1380, "y": 200},
        "config": {
          "title": "Review RFQ Documents Before Sending",
          "assignee_role": "owner"
        },
        "inputs": ["documents"],
        "outputs": ["approved", "comments"]
      },
      {
        "id": "node-logger",
        "type": "core.logger",
        "label": "Log Completion",
        "position": {"x": 1600, "y": 200},
        "config": {
          "message": "BOQ-to-RFQ workflow completed successfully.",
          "level": "info"
        },
        "inputs": ["approved"],
        "outputs": ["logged"]
      }
    ],
    "edges": [
      {"id": "e1", "source": "node-trigger",      "target": "node-read-boq"},
      {"id": "e2", "source": "node-read-boq",     "target": "node-clean-boq"},
      {"id": "e3", "source": "node-clean-boq",    "target": "node-classify"},
      {"id": "e4", "source": "node-classify",     "target": "node-split"},
      {"id": "e5", "source": "node-split",        "target": "node-generate-rfq"},
      {"id": "e6", "source": "node-generate-rfq", "target": "node-approval"},
      {"id": "e7", "source": "node-approval",     "target": "node-logger"}
    ],
    "variables": {},
    "metadata": {
      "name": "BOQ to RFQ",
      "description": "AI-assisted BOQ classification and RFQ generation workflow.",
      "version": "1.0.0",
      "author": "QS-OS"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  definition  = EXCLUDED.definition,
  updated_at  = now();
