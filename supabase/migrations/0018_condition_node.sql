-- ============================================================
-- Migration 0018: Condition Node seed
-- Sprint 14 (S14-006)
-- ============================================================
-- Registers workflow.condition in the node registry.
-- The Condition Node is a data-driven routing node:
--   - Evaluates an expression against an input value at runtime
--   - Routes to true_path or false_path output handle
--   - Distinct from the Pipeline SwitchNode (user-driven, Sprint 12)
-- ============================================================

INSERT INTO registered_nodes (
  type, name, description, version, category, icon, color, pack_id,
  inputs, outputs, config_schema, ui_schema,
  uses_services, data_pack_deps, is_enabled
)
VALUES (
  'workflow.condition',
  'Condition',
  'Data-driven routing. Evaluates an expression against an upstream value and routes to the true path or false path automatically.',
  '1.0.0',
  'control',
  '◇',
  '#0D9488',
  'lados.core-pack',
  '[
    {"id": "value", "label": "Value", "type": "any", "description": "The value to evaluate"}
  ]'::jsonb,
  '[
    {"id": "true_path",  "label": "✓ True",  "type": "any", "description": "Output when condition is true"},
    {"id": "false_path", "label": "✗ False", "type": "any", "description": "Output when condition is false"}
  ]'::jsonb,
  '[
    {
      "key": "expression",
      "label": "Condition Expression",
      "type": "text",
      "required": true,
      "placeholder": "e.g.  value >= 100  |  value == \"approved\"  |  value != null",
      "description": "Supported operators: >=, <=, >, <, ==, !=, includes, !includes, != null, == null"
    },
    {
      "key": "label",
      "label": "Label (optional)",
      "type": "text",
      "required": false,
      "placeholder": "e.g. Amount ≥ RM 100k?"
    }
  ]'::jsonb,
  '{
    "sections": [
      {
        "id": "condition",
        "label": "Condition",
        "fields": ["expression", "label"]
      }
    ]
  }'::jsonb,
  ARRAY[]::text[],
  ARRAY[]::text[],
  true
)
ON CONFLICT (type) DO UPDATE
  SET
    name          = EXCLUDED.name,
    description   = EXCLUDED.description,
    config_schema = EXCLUDED.config_schema,
    ui_schema     = EXCLUDED.ui_schema,
    outputs       = EXCLUDED.outputs,
    color         = EXCLUDED.color,
    updated_at    = now();
