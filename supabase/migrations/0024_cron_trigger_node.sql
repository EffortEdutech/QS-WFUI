-- Migration: 0024_cron_trigger_node.sql
-- Seeds the core.cron_trigger node into registered_nodes.
-- Sprint 18 (S18-003)

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
  'core.cron_trigger',
  'lados.core-pack',
  'Cron Trigger',
  'Fires a workflow on a recurring cron schedule. When run manually it behaves as an immediate trigger and returns the current timestamp. Connect to a scheduler to automate periodic runs.',
  '1.0.0',
  'core',
  'clock',
  '#6366F1',
  ARRAY['cron', 'trigger', 'schedule', 'automation', 'timer'],

  -- inputs: none — source/trigger node
  '[]'::jsonb,

  -- outputs
  '[
    {"id":"triggered_at",    "label":"Triggered At",    "type":"string",
     "description":"ISO 8601 timestamp of when the trigger fired"},
    {"id":"cron_expression", "label":"Cron Expression", "type":"string",
     "description":"The configured cron expression (e.g. \"0 8 * * 1-5\")"},
    {"id":"timezone",        "label":"Timezone",        "type":"string",
     "description":"IANA timezone string used for schedule evaluation"},
    {"id":"schedule_label",  "label":"Schedule Label",  "type":"string",
     "description":"Human-readable description, e.g. \"Daily at 08:00\""}
  ]'::jsonb,

  -- config_schema
  '[
    {
      "key":         "cron_expression",
      "label":       "Cron Expression",
      "type":        "string",
      "required":    true,
      "placeholder": "0 8 * * 1-5",
      "description": "Standard 5-field cron. Examples: \"0 8 * * 1-5\" (weekdays 08:00), \"0 0 1 * *\" (1st of month), \"*/15 * * * *\" (every 15 min)."
    },
    {
      "key":          "timezone",
      "label":        "Timezone",
      "type":         "string",
      "required":     false,
      "defaultValue": "Asia/Kuala_Lumpur",
      "description":  "IANA timezone for schedule evaluation."
    },
    {
      "key":         "description",
      "label":       "Description",
      "type":        "string",
      "required":    false,
      "placeholder": "Morning digest",
      "description": "Optional human label shown in logs."
    }
  ]'::jsonb,

  -- ui_schema
  '{"title":"Cron Trigger","category":"core","color":"#6366F1","description":"Fires the workflow on a recurring cron schedule."}'::jsonb
)
ON CONFLICT (type) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  pack_id       = EXCLUDED.pack_id,
  version       = EXCLUDED.version,
  category      = EXCLUDED.category,
  icon          = EXCLUDED.icon,
  color         = EXCLUDED.color,
  tags          = EXCLUDED.tags,
  inputs        = EXCLUDED.inputs,
  outputs       = EXCLUDED.outputs,
  config_schema = EXCLUDED.config_schema,
  ui_schema     = EXCLUDED.ui_schema,
  updated_at    = now();

-- Service metadata (for Skill Inspector badges)
UPDATE registered_nodes SET
  uses_services  = ARRAY['scheduler'],
  data_pack_deps = ARRAY[]::text[]
WHERE type = 'core.cron_trigger';
