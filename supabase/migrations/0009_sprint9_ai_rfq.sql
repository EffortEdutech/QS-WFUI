-- ============================================================
-- Migration 0009: Sprint 9 — AI Classification + RFQ
-- Sprint 9 (S9-001)
-- ============================================================
-- Tables:
--   ai_prompts — reusable prompt templates for AI nodes
-- ============================================================

-- ── ai_prompts ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_prompts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,              -- e.g. 'prompt.boq_classification'
  description           text,
  system_prompt         text NOT NULL,
  user_prompt_template  text NOT NULL,                    -- {{variables}} replaced at runtime
  model                 text NOT NULL DEFAULT 'gpt-4o-mini',
  temperature           numeric(3,2) NOT NULL DEFAULT 0.10,
  max_tokens            int NOT NULL DEFAULT 2048,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Seed: BOQ classification prompt ──────────────────────────────────────────

INSERT INTO ai_prompts (slug, description, system_prompt, user_prompt_template, model, temperature, max_tokens)
VALUES (
  'prompt.boq_classification',
  'Classify BOQ line items into standard Malaysian construction trade categories (CIDB)',
  'You are a senior Quantity Surveyor assistant specialising in Malaysian construction cost estimation.
Your task is to classify Bill of Quantities (BOQ) items into standard trade categories used by CIDB Malaysia.
Return ONLY valid JSON — no markdown fences, no explanation, no trailing text.
Valid trades: civil, structural, mechanical, electrical, plumbing, finishing, external, preliminaries, others',
  'Classify each BOQ item below by trade category.

Trade definitions:
- civil: earthworks, excavation, backfilling, piling, foundations, drainage, culverts, roads/pavement
- structural: reinforced concrete, structural steelwork, beams, columns, slabs, retaining walls
- mechanical: HVAC, air-conditioning, ventilation, lifts/elevators, escalators, fire suppression, BMS
- electrical: power distribution, lighting, cabling, switchgear, transformers, generators, earthing, ELV/ICT
- plumbing: water supply, sewerage, sanitary fittings, pumps, water tanks, hot water systems
- finishing: internal plaster, tiling, flooring, false ceilings, painting/coating, doors, windows, glazing, partitions
- external: landscaping, fencing, gates, boundary walls, car parks, signage, external drainage
- preliminaries: site establishment, insurances, performance bonds, testing & commissioning, as-built drawings
- others: anything not clearly fitting the above

Return a JSON array (not an object) of classification results, one per item:
[
  {"item_no": "...", "description": "...", "trade": "civil", "confidence": 0.95},
  ...
]

BOQ Items:
{{items}}',
  'gpt-4o-mini',
  0.10,
  2048
)
ON CONFLICT (slug) DO UPDATE SET
  description          = EXCLUDED.description,
  system_prompt        = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  model                = EXCLUDED.model,
  temperature          = EXCLUDED.temperature,
  max_tokens           = EXCLUDED.max_tokens,
  updated_at           = now();

-- ── Update qs.classify_trade config_schema — expose AI toggle + project_name ──

UPDATE registered_nodes
SET config_schema = '[
  {"key":"classification_standard","label":"Classification Standard","type":"select","required":false,"defaultValue":"CIDB",
   "options":[{"value":"CIDB","label":"CIDB (Malaysia)"},{"value":"CIBSE","label":"CIBSE (UK)"},{"value":"custom","label":"Custom"}]},
  {"key":"confidence_threshold","label":"Min Confidence (0–1)","type":"number","required":false,"defaultValue":0.6,
   "description":"Items below this threshold are flagged as warnings."},
  {"key":"use_ai","label":"Use AI Classification","type":"boolean","required":false,"defaultValue":true,
   "description":"If disabled or OpenAI key not set, falls back to keyword-based classifier."}
]'::jsonb
WHERE type = 'qs.classify_trade';

-- ── Update procurement.generate_rfq config_schema — add project_name + closing date ──

UPDATE registered_nodes
SET config_schema = '[
  {"key":"rfq_title","label":"RFQ Title","type":"string","required":false,
   "placeholder":"RFQ — Civil Works Package"},
  {"key":"project_name","label":"Project Name","type":"string","required":false,
   "placeholder":"Hospital B — New Wing Construction"},
  {"key":"closing_date","label":"Response Closing Date","type":"string","required":false,
   "placeholder":"2026-07-31"},
  {"key":"due_date_days","label":"Response Due (Days from today)","type":"number","required":false,"defaultValue":14},
  {"key":"max_packages","label":"Max Trade Packages to Generate","type":"number","required":false,"defaultValue":5,
   "description":"Limit output to first N packages to manage file size."},
  {"key":"include_boq","label":"Include Full BOQ Table","type":"boolean","required":false,"defaultValue":true}
]'::jsonb
WHERE type = 'procurement.generate_rfq';
