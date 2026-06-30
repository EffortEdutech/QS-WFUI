-- ============================================================
-- Migration 0005: Seed 12 MVP Nodes
-- Sprint 5 (S5-005)
-- ============================================================

INSERT INTO registered_nodes
  (type, pack_id, name, description, version, category, icon, color, tags, inputs, outputs, config_schema, ui_schema)
VALUES

-- ── CORE PACK ────────────────────────────────────────────────────────────────

(
  'core.manual_trigger',
  'lados.core-pack',
  'Manual Trigger',
  'Starts a workflow run manually or via the API.',
  '1.0.0', 'core', 'play-circle', '#6B7280',
  ARRAY['trigger', 'start'],
  '[]'::jsonb,
  '[{"id":"trigger_data","label":"Trigger Data","type":"json","required":false}]'::jsonb,
  '[]'::jsonb,
  '{"title":"Manual Trigger","category":"core","color":"#6B7280","description":"Starts a workflow run manually."}'::jsonb
),
(
  'core.human_approval',
  'lados.core-pack',
  'Human Approval',
  'Pauses the workflow and waits for a human to approve or reject.',
  '1.0.0', 'core', 'user-check', '#6B7280',
  ARRAY['approval', 'human', 'gate'],
  '[{"id":"data","label":"Data to Review","type":"json","required":false}]'::jsonb,
  '[{"id":"approved","label":"Approved","type":"boolean"},{"id":"rejected","label":"Rejected","type":"boolean"},{"id":"comments","label":"Comments","type":"string"}]'::jsonb,
  '[{"key":"title","label":"Approval Title","type":"string","required":true,"placeholder":"Review BOQ before RFQ"},{"key":"assignee_role","label":"Assignee Role","type":"select","required":false,"options":[{"value":"owner","label":"Owner"},{"value":"admin","label":"Admin"},{"value":"member","label":"Member"}]}]'::jsonb,
  '{"title":"Human Approval","category":"core","color":"#6B7280","description":"Pauses for human decision."}'::jsonb
),
(
  'core.logger',
  'lados.core-pack',
  'Logger',
  'Logs a message or data snapshot to the execution log.',
  '1.0.0', 'core', 'terminal', '#6B7280',
  ARRAY['log', 'debug'],
  '[{"id":"data","label":"Data","type":"any","required":false}]'::jsonb,
  '[{"id":"logged","label":"Logged Data","type":"any"}]'::jsonb,
  '[{"key":"message","label":"Message","type":"string","required":false,"placeholder":"Checkpoint reached"},{"key":"level","label":"Log Level","type":"select","required":false,"options":[{"value":"info","label":"Info"},{"value":"warn","label":"Warning"},{"value":"error","label":"Error"}]}]'::jsonb,
  '{"title":"Logger","category":"core","color":"#6B7280","description":"Logs data to execution log."}'::jsonb
),

-- ── DOCUMENT PACK ────────────────────────────────────────────────────────────

(
  'document.upload_file',
  'lados.document-pack',
  'Upload File',
  'Accepts a file upload and stores it in the project storage bucket.',
  '1.0.0', 'document', 'upload', '#F59E0B',
  ARRAY['file', 'upload', 'storage'],
  '[]'::jsonb,
  '[{"id":"file_url","label":"File URL","type":"string"},{"id":"file_name","label":"File Name","type":"string"},{"id":"mime_type","label":"MIME Type","type":"string"}]'::jsonb,
  '[{"key":"allowed_types","label":"Allowed File Types","type":"multiselect","required":false,"options":[{"value":"xlsx","label":"Excel (.xlsx)"},{"value":"pdf","label":"PDF (.pdf)"},{"value":"csv","label":"CSV (.csv)"},{"value":"docx","label":"Word (.docx)"}]},{"key":"max_size_mb","label":"Max Size (MB)","type":"number","required":false,"defaultValue":50}]'::jsonb,
  '{"title":"Upload File","category":"document","color":"#F59E0B","description":"Accepts file uploads."}'::jsonb
),
(
  'document.read_excel',
  'lados.document-pack',
  'Read Excel',
  'Reads an Excel spreadsheet and emits rows as structured JSON.',
  '1.0.0', 'document', 'file-spreadsheet', '#F59E0B',
  ARRAY['excel', 'xlsx', 'spreadsheet'],
  '[{"id":"file_url","label":"File URL","type":"string","required":true}]'::jsonb,
  '[{"id":"rows","label":"Rows","type":"array"},{"id":"headers","label":"Headers","type":"array"},{"id":"sheet_names","label":"Sheet Names","type":"array"}]'::jsonb,
  '[{"key":"sheet_name","label":"Sheet Name","type":"string","required":false,"placeholder":"Sheet1"},{"key":"header_row","label":"Header Row Number","type":"number","required":false,"defaultValue":1},{"key":"skip_empty","label":"Skip Empty Rows","type":"boolean","required":false,"defaultValue":true}]'::jsonb,
  '{"title":"Read Excel","category":"document","color":"#F59E0B","description":"Reads Excel spreadsheets."}'::jsonb
),
(
  'document.save_file',
  'lados.document-pack',
  'Save File',
  'Saves generated content to the project storage bucket.',
  '1.0.0', 'document', 'save', '#F59E0B',
  ARRAY['file', 'save', 'output'],
  '[{"id":"content","label":"Content","type":"any","required":true},{"id":"file_name","label":"File Name","type":"string","required":false}]'::jsonb,
  '[{"id":"file_url","label":"Saved File URL","type":"string"}]'::jsonb,
  '[{"key":"file_name","label":"Output File Name","type":"string","required":true,"placeholder":"output.xlsx"},{"key":"format","label":"Format","type":"select","required":true,"options":[{"value":"xlsx","label":"Excel (.xlsx)"},{"value":"pdf","label":"PDF (.pdf)"},{"value":"csv","label":"CSV (.csv)"},{"value":"json","label":"JSON (.json)"}]}]'::jsonb,
  '{"title":"Save File","category":"document","color":"#F59E0B","description":"Saves files to storage."}'::jsonb
),

-- ── QS PACK ──────────────────────────────────────────────────────────────────

(
  'qs.read_boq',
  'lados.qs-pack',
  'Read BOQ',
  'Reads a Bill of Quantities spreadsheet and emits structured BOQ line items.',
  '1.0.0', 'qs', 'list', '#3B82F6',
  ARRAY['boq', 'excel', 'estimation', 'quantity-surveying'],
  '[{"id":"file_url","label":"BOQ File URL","type":"string","required":true}]'::jsonb,
  '[{"id":"boq_items","label":"BOQ Items","type":"array"},{"id":"trade_summary","label":"Trade Summary","type":"object"},{"id":"warnings","label":"Warnings","type":"array"}]'::jsonb,
  '[{"key":"sheet_name","label":"Sheet Name","type":"string","required":false,"placeholder":"BOQ"},{"key":"header_row","label":"Header Row","type":"number","required":false,"defaultValue":1},{"key":"currency","label":"Currency","type":"select","required":false,"defaultValue":"MYR","options":[{"value":"MYR","label":"MYR (Ringgit)"},{"value":"USD","label":"USD"},{"value":"SGD","label":"SGD"}]},{"key":"trade_column","label":"Trade Column Header","type":"string","required":false,"placeholder":"Trade"}]'::jsonb,
  '{"title":"Read BOQ","category":"qs","color":"#3B82F6","description":"Reads BOQ spreadsheets and emits structured line items."}'::jsonb
),
(
  'qs.clean_boq',
  'lados.qs-pack',
  'Clean BOQ',
  'Normalises and deduplicates BOQ items — trims whitespace, merges duplicates, validates quantities.',
  '1.0.0', 'qs', 'filter', '#3B82F6',
  ARRAY['boq', 'clean', 'normalise'],
  '[{"id":"boq_items","label":"BOQ Items","type":"array","required":true}]'::jsonb,
  '[{"id":"clean_items","label":"Clean BOQ Items","type":"array"},{"id":"removed_count","label":"Removed Count","type":"number"}]'::jsonb,
  '[{"key":"remove_zero_qty","label":"Remove Zero-Quantity Items","type":"boolean","required":false,"defaultValue":true},{"key":"trim_descriptions","label":"Trim Descriptions","type":"boolean","required":false,"defaultValue":true}]'::jsonb,
  '{"title":"Clean BOQ","category":"qs","color":"#3B82F6","description":"Normalises BOQ items."}'::jsonb
),
(
  'qs.classify_trade',
  'lados.qs-pack',
  'Classify Trade',
  'AI-assisted classification of BOQ items into standard trade categories (CIDB/CIBSE).',
  '1.0.0', 'qs', 'tag', '#3B82F6',
  ARRAY['boq', 'trade', 'ai', 'classification'],
  '[{"id":"boq_items","label":"BOQ Items","type":"array","required":true}]'::jsonb,
  '[{"id":"classified_items","label":"Classified Items","type":"array"},{"id":"confidence_scores","label":"Confidence Scores","type":"object"}]'::jsonb,
  '[{"key":"classification_standard","label":"Classification Standard","type":"select","required":false,"defaultValue":"CIDB","options":[{"value":"CIDB","label":"CIDB (Malaysia)"},{"value":"CIBSE","label":"CIBSE (UK)"},{"value":"custom","label":"Custom"}]},{"key":"confidence_threshold","label":"Confidence Threshold","type":"number","required":false,"defaultValue":0.7}]'::jsonb,
  '{"title":"Classify Trade","category":"qs","color":"#3B82F6","description":"AI-assisted trade classification."}'::jsonb
),
(
  'qs.split_work_package',
  'lados.qs-pack',
  'Split Work Package',
  'Groups classified BOQ items into work packages ready for RFQ.',
  '1.0.0', 'qs', 'scissors', '#3B82F6',
  ARRAY['boq', 'work-package', 'procurement'],
  '[{"id":"classified_items","label":"Classified BOQ Items","type":"array","required":true}]'::jsonb,
  '[{"id":"work_packages","label":"Work Packages","type":"array"},{"id":"package_count","label":"Package Count","type":"number"}]'::jsonb,
  '[{"key":"grouping_strategy","label":"Grouping Strategy","type":"select","required":false,"defaultValue":"by_trade","options":[{"value":"by_trade","label":"By Trade"},{"value":"by_location","label":"By Location"},{"value":"by_value","label":"By Value Range"}]},{"key":"max_items_per_package","label":"Max Items per Package","type":"number","required":false,"defaultValue":50}]'::jsonb,
  '{"title":"Split Work Package","category":"qs","color":"#3B82F6","description":"Groups BOQ items into work packages."}'::jsonb
),

-- ── PROCUREMENT PACK ─────────────────────────────────────────────────────────

(
  'procurement.generate_rfq',
  'lados.procurement-pack',
  'Generate RFQ',
  'Generates a Request for Quotation document from a work package.',
  '1.0.0', 'procurement', 'send', '#10B981',
  ARRAY['rfq', 'procurement', 'vendor', 'quotation'],
  '[{"id":"work_packages","label":"Work Packages","type":"array","required":true}]'::jsonb,
  '[{"id":"rfq_document","label":"RFQ Document URL","type":"string"},{"id":"rfq_summary","label":"RFQ Summary","type":"object"}]'::jsonb,
  '[{"key":"rfq_title","label":"RFQ Title","type":"string","required":true,"placeholder":"RFQ for Structural Works — Block A"},{"key":"due_date_days","label":"Response Due (Days)","type":"number","required":false,"defaultValue":14},{"key":"output_format","label":"Output Format","type":"select","required":false,"defaultValue":"xlsx","options":[{"value":"xlsx","label":"Excel (.xlsx)"},{"value":"pdf","label":"PDF (.pdf)"},{"value":"docx","label":"Word (.docx)"}]},{"key":"include_boq","label":"Include Full BOQ","type":"boolean","required":false,"defaultValue":true}]'::jsonb,
  '{"title":"Generate RFQ","category":"procurement","color":"#10B981","description":"Generates RFQ documents from work packages."}'::jsonb
),

-- ── AI PACK ──────────────────────────────────────────────────────────────────

(
  'ai.classifier',
  'lados.ai-pack',
  'AI Classifier',
  'Classifies input text or structured data using a configurable AI model.',
  '1.0.0', 'ai', 'zap', '#8B5CF6',
  ARRAY['ai', 'classification', 'nlp'],
  '[{"id":"input","label":"Input","type":"any","required":true}]'::jsonb,
  '[{"id":"class","label":"Class","type":"string"},{"id":"confidence","label":"Confidence","type":"number"},{"id":"alternatives","label":"Alternatives","type":"array"}]'::jsonb,
  '[{"key":"categories","label":"Categories (comma-separated)","type":"textarea","required":true,"placeholder":"structural,mechanical,electrical,plumbing"},{"key":"model","label":"AI Model","type":"select","required":false,"defaultValue":"gpt-4o-mini","options":[{"value":"gpt-4o-mini","label":"GPT-4o Mini (fast)"},{"value":"gpt-4o","label":"GPT-4o (accurate)"}]},{"key":"confidence_threshold","label":"Min Confidence","type":"number","required":false,"defaultValue":0.6}]'::jsonb,
  '{"title":"AI Classifier","category":"ai","color":"#8B5CF6","description":"Classifies data using AI."}'::jsonb
)

ON CONFLICT (type) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  pack_id      = EXCLUDED.pack_id,
  category     = EXCLUDED.category,
  tags         = EXCLUDED.tags,
  inputs       = EXCLUDED.inputs,
  outputs      = EXCLUDED.outputs,
  config_schema = EXCLUDED.config_schema,
  ui_schema    = EXCLUDED.ui_schema,
  updated_at   = now();
