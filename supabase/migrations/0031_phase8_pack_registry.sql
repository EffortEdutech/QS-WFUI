-- ============================================================
-- Migration 0031: Phase 8 — Pack Installer & Registry
--
-- 1. Upgrade packs table: add dependencies, installed_at, status
-- 2. Seed lados.foundation-pack row
-- 3. Register foundation-pack nodes in registered_nodes
-- ============================================================

-- ── 1. Upgrade packs table ────────────────────────────────────────────────────

-- Pack dependencies (other pack IDs this pack requires to be active)
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS dependencies jsonb NOT NULL DEFAULT '[]';

-- When this pack was first installed/synced
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS installed_at timestamptz NOT NULL DEFAULT now();

-- Lifecycle status: active | disabled | error
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'error'));

COMMENT ON COLUMN packs.dependencies IS
  'JSON array of pack IDs that must be active for this pack to function';
COMMENT ON COLUMN packs.installed_at IS
  'Timestamp when this pack was first registered by PackInstaller';
COMMENT ON COLUMN packs.status IS
  'active | disabled | error — managed by PackInstallerService';

-- ── 2. Seed lados.foundation-pack ────────────────────────────────────────────

INSERT INTO packs (
  id, display_name, description, author, version,
  icon, color, is_official, is_enabled, status, dependencies
) VALUES (
  'lados.foundation-pack',
  'Foundation Pack',
  'Universal capabilities — notifications, approval gates, user assignment. Mandatory base pack for all Lados workspaces.',
  'Lados Platform',
  '0.1.0',
  'layers',
  '#6366F1',
  true,
  true,
  'active',
  '[]'
) ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  version      = EXCLUDED.version,
  status       = 'active',
  is_enabled   = true,
  updated_at   = now();

-- ── 3. Register foundation-pack nodes ────────────────────────────────────────

INSERT INTO registered_nodes (
  type, pack_id, name, description, version, category,
  icon, color, tags, inputs, outputs, config_schema, ui_schema, is_enabled
) VALUES

-- foundation.send_notification
(
  'foundation.send_notification',
  'lados.foundation-pack',
  'Send Notification',
  'Send an in-app notification to a user from within a workflow.',
  '0.1.0',
  'output',
  '🔔',
  '#6366F1',
  ARRAY['notification', 'alert', 'message', 'foundation'],
  '[
    {"key": "userId",    "label": "User ID",      "type": "string",  "required": true},
    {"key": "title",     "label": "Title",         "type": "string",  "required": true},
    {"key": "message",   "label": "Message",       "type": "string",  "required": false},
    {"key": "type",      "label": "Type",          "type": "select",  "required": false},
    {"key": "actionUrl", "label": "Action URL",    "type": "string",  "required": false}
  ]'::jsonb,
  '[
    {"key": "notified",        "label": "Notified",         "type": "boolean"},
    {"key": "notificationId",  "label": "Notification ID",  "type": "string"}
  ]'::jsonb,
  '[
    {"key": "userId",    "label": "User ID",   "type": "string",  "required": true,  "placeholder": "User UUID"},
    {"key": "title",     "label": "Title",     "type": "string",  "required": true,  "placeholder": "Notification title"},
    {"key": "message",   "label": "Message",   "type": "string",  "required": false, "placeholder": "Optional body text"},
    {"key": "type",      "label": "Type",      "type": "select",  "required": false,
      "options": [
        {"value": "system",           "label": "System"},
        {"value": "approval_request", "label": "Approval Request"},
        {"value": "execution_complete","label": "Execution Complete"}
      ]},
    {"key": "actionUrl", "label": "Action URL","type": "string",  "required": false, "placeholder": "/approvals?taskId=..."}
  ]'::jsonb,
  '{"layout": "vertical"}'::jsonb,
  true
),

-- foundation.request_approval
(
  'foundation.request_approval',
  'lados.foundation-pack',
  'Request Approval',
  'Create a human approval gate. Pauses the workflow until an owner or admin approves or rejects.',
  '0.1.0',
  'approval',
  '✅',
  '#6366F1',
  ARRAY['approval', 'human', 'gate', 'pause', 'review', 'foundation'],
  '[
    {"key": "title",        "label": "Title",         "type": "string", "required": true},
    {"key": "description",  "label": "Description",   "type": "string", "required": false},
    {"key": "assigneeRole", "label": "Assignee Role", "type": "string", "required": false},
    {"key": "notifyUserId", "label": "Notify User",   "type": "string", "required": false}
  ]'::jsonb,
  '[
    {"key": "approvalTaskId", "label": "Approval Task ID", "type": "string"},
    {"key": "assigneeRole",   "label": "Assignee Role",    "type": "string"},
    {"key": "pending",        "label": "Pending",          "type": "boolean"}
  ]'::jsonb,
  '[
    {"key": "title",        "label": "Title",         "type": "string", "required": true,  "placeholder": "Approve invoice payment"},
    {"key": "description",  "label": "Description",   "type": "string", "required": false, "placeholder": "Describe what needs to be reviewed"},
    {"key": "assigneeRole", "label": "Assignee Role", "type": "select", "required": false,
      "options": [
        {"value": "owner", "label": "Owner"},
        {"value": "admin", "label": "Admin"}
      ]},
    {"key": "notifyUserId", "label": "Notify User ID","type": "string", "required": false, "placeholder": "UUID of user to notify"}
  ]'::jsonb,
  '{"layout": "vertical"}'::jsonb,
  true
),

-- foundation.assign_user
(
  'foundation.assign_user',
  'lados.foundation-pack',
  'Assign User',
  'Assign a user to a resource (sets data.assignee / data.assigneeRole).',
  '0.1.0',
  'processing',
  '👤',
  '#6366F1',
  ARRAY['assign', 'user', 'resource', 'ownership', 'foundation'],
  '[
    {"key": "resourceId",   "label": "Resource ID",   "type": "string", "required": true},
    {"key": "userId",       "label": "User ID",       "type": "string", "required": true},
    {"key": "assigneeRole", "label": "Assignee Role", "type": "string", "required": false}
  ]'::jsonb,
  '[
    {"key": "assigned",     "label": "Assigned",      "type": "boolean"},
    {"key": "resourceId",   "label": "Resource ID",   "type": "string"},
    {"key": "userId",       "label": "User ID",       "type": "string"},
    {"key": "assigneeRole", "label": "Assignee Role", "type": "string"}
  ]'::jsonb,
  '[
    {"key": "resourceId",   "label": "Resource ID",    "type": "string", "required": true,  "placeholder": "UUID of the resource"},
    {"key": "userId",       "label": "User ID",        "type": "string", "required": true,  "placeholder": "UUID of the user to assign"},
    {"key": "assigneeRole", "label": "Assignee Role",  "type": "string", "required": false, "placeholder": "e.g. driver, reviewer"}
  ]'::jsonb,
  '{"layout": "vertical"}'::jsonb,
  true
)

ON CONFLICT (type) DO UPDATE SET
  pack_id      = EXCLUDED.pack_id,
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  version      = EXCLUDED.version,
  category     = EXCLUDED.category,
  config_schema = EXCLUDED.config_schema,
  outputs      = EXCLUDED.outputs,
  inputs       = EXCLUDED.inputs,
  updated_at   = now();
