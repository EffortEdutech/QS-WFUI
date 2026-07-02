-- ============================================================
-- Migration 0051: Lados V4 Data Pack Engine
-- Phase 19
-- ============================================================
-- Upgrades the older V3 data_packs catalogue into the V4 governed
-- Data Pack model: versions, collections, searchable items, and
-- organization install state.
-- ============================================================

ALTER TABLE data_packs
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE data_packs
SET publisher = COALESCE(publisher, provider, 'Lados')
WHERE publisher IS NULL;

ALTER TABLE data_packs
  ALTER COLUMN publisher SET DEFAULT 'Lados';

CREATE TABLE IF NOT EXISTS data_pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_pack_id uuid NOT NULL REFERENCES data_packs(id) ON DELETE CASCADE,
  version text NOT NULL,
  source_summary text,
  effective_from date,
  effective_to date,
  region text,
  currency text,
  unit_system text,
  checksum text,
  manifest_json jsonb NOT NULL DEFAULT '{}',
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_pack_id, version)
);

CREATE TABLE IF NOT EXISTS data_pack_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES data_pack_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  display_name text NOT NULL,
  description text,
  schema_json jsonb NOT NULL DEFAULT '{}',
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, key)
);

CREATE TABLE IF NOT EXISTS data_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES data_pack_collections(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  title text NOT NULL,
  description text,
  unit text,
  value_json jsonb NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  source_name text NOT NULL,
  source_url text,
  source_date date,
  region text,
  effective_from date,
  effective_to date,
  classification text,
  applicability_notes text,
  assumptions text,
  advisory_status text NOT NULL DEFAULT 'reference_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, item_key)
);

CREATE TABLE IF NOT EXISTS org_data_pack_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data_pack_id uuid NOT NULL REFERENCES data_packs(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES data_pack_versions(id) ON DELETE RESTRICT,
  installed_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, data_pack_id)
);

CREATE INDEX IF NOT EXISTS data_pack_versions_pack_idx ON data_pack_versions(data_pack_id);
CREATE INDEX IF NOT EXISTS data_pack_collections_version_idx ON data_pack_collections(version_id);
CREATE INDEX IF NOT EXISTS data_pack_items_collection_idx ON data_pack_items(collection_id);
CREATE INDEX IF NOT EXISTS data_pack_items_tags_idx ON data_pack_items USING gin(tags);
CREATE INDEX IF NOT EXISTS data_pack_items_title_idx ON data_pack_items USING gin(to_tsvector('english', title || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS org_data_pack_installs_org_idx ON org_data_pack_installs(organization_id);
CREATE INDEX IF NOT EXISTS org_data_pack_installs_status_idx ON org_data_pack_installs(status);

ALTER TABLE data_pack_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_pack_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_data_pack_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_pack_versions_select" ON data_pack_versions;
CREATE POLICY "data_pack_versions_select" ON data_pack_versions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "data_pack_collections_select" ON data_pack_collections;
CREATE POLICY "data_pack_collections_select" ON data_pack_collections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "data_pack_items_select" ON data_pack_items;
CREATE POLICY "data_pack_items_select" ON data_pack_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "org_data_pack_installs_select" ON org_data_pack_installs;
CREATE POLICY "org_data_pack_installs_select" ON org_data_pack_installs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "org_data_pack_installs_insert" ON org_data_pack_installs;
CREATE POLICY "org_data_pack_installs_insert" ON org_data_pack_installs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_data_pack_installs_update" ON org_data_pack_installs;
CREATE POLICY "org_data_pack_installs_update" ON org_data_pack_installs
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------
-- Official Phase 19 Data Packs
-- ------------------------------------------------------------

INSERT INTO data_packs (slug, display_name, description, version, provider, publisher, region, domain, category, is_official, is_enabled, status, icon, metadata)
VALUES
  ('lados.qs-rate-library', 'Lados QS Rate Library', 'Versioned quantity surveying rate references with unit, region, source date, and advisory basis.', '0.1.0', 'Lados', 'Lados', 'MY', 'Quantity Surveying', 'Rates', true, true, 'active', 'table', '{"phase":"19","guardrail":"reference_only"}'),
  ('lados.boq-item-library', 'Lados BOQ Item Library', 'Standard BOQ item templates for construction work sections with measurement basis and scope notes.', '0.1.0', 'Lados', 'Lados', 'MY', 'Construction', 'BOQ', true, true, 'active', 'list', '{"phase":"19","guardrail":"template_only"}'),
  ('lados.claim-evidence-rules', 'Lados Claim Evidence Rules', 'Advisory evidence checklists for progress claims, variations, final accounts, instructions, and measurement records.', '0.1.0', 'Lados', 'Lados', 'MY', 'Contract Administration', 'Evidence', true, true, 'active', 'checklist', '{"phase":"19","guardrail":"does_not_certify"}'),
  ('lados.construction-standards-index', 'Malaysian Construction Standards Index', 'Searchable index of construction standards and specification references without storing restricted full text.', '0.1.0', 'Lados', 'Lados', 'MY', 'Compliance', 'Standards', true, true, 'active', 'book-open', '{"phase":"19","guardrail":"reference_index_only"}'),
  ('lados.contractor-productivity-library', 'Contractor Plant and Labour Productivity Library', 'Plant and labour productivity assumptions for contractor planning with assumptions and applicability notes.', '0.1.0', 'Lados', 'Lados', 'MY', 'Contractor Operations', 'Productivity', true, true, 'active', 'gauge', '{"phase":"19","guardrail":"assumption_required"}')
ON CONFLICT (slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  provider = EXCLUDED.provider,
  publisher = EXCLUDED.publisher,
  region = EXCLUDED.region,
  domain = EXCLUDED.domain,
  category = EXCLUDED.category,
  is_official = EXCLUDED.is_official,
  is_enabled = EXCLUDED.is_enabled,
  status = EXCLUDED.status,
  icon = EXCLUDED.icon,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO data_pack_versions (data_pack_id, version, source_summary, effective_from, region, currency, unit_system, checksum, manifest_json)
SELECT id, '0.1.0', 'Phase 19 curated seed data for product verification. Values are illustrative references and must be reviewed by a human before commercial use.', date '2026-01-01', region, 'MYR', 'metric', slug || ':0.1.0',
  jsonb_build_object('slug', slug, 'version', '0.1.0', 'phase', '19', 'advisory', true)
FROM data_packs
WHERE slug IN (
  'lados.qs-rate-library',
  'lados.boq-item-library',
  'lados.claim-evidence-rules',
  'lados.construction-standards-index',
  'lados.contractor-productivity-library'
)
ON CONFLICT (data_pack_id, version) DO UPDATE
SET
  source_summary = EXCLUDED.source_summary,
  effective_from = EXCLUDED.effective_from,
  region = EXCLUDED.region,
  currency = EXCLUDED.currency,
  unit_system = EXCLUDED.unit_system,
  checksum = EXCLUDED.checksum,
  manifest_json = EXCLUDED.manifest_json;

INSERT INTO data_pack_collections (version_id, key, display_name, description, schema_json)
SELECT v.id, collection_key, collection_name, collection_description, collection_schema
FROM data_pack_versions v
JOIN data_packs p ON p.id = v.data_pack_id
JOIN (
  VALUES
    ('lados.qs-rate-library', 'rates', 'Rate References', 'Advisory rate references with classification and provenance.', '{"fields":["unit","value_json.rate","classification","source_name","source_date"]}'::jsonb),
    ('lados.boq-item-library', 'boq_items', 'BOQ Item Templates', 'Reusable BOQ item descriptions and measurement basis notes.', '{"fields":["unit","measurement_basis","work_section"]}'::jsonb),
    ('lados.claim-evidence-rules', 'claim_evidence_rules', 'Claim Evidence Rules', 'Evidence checklists by claim and variation scenario.', '{"fields":["claim_type","evidence","severity"]}'::jsonb),
    ('lados.construction-standards-index', 'standards_index', 'Standards Reference Index', 'Reference-only index for standards and specifications.', '{"fields":["publisher","code","scope_note"]}'::jsonb),
    ('lados.contractor-productivity-library', 'productivity', 'Productivity Assumptions', 'Plant and labour productivity assumptions with exclusions.', '{"fields":["crew","plant","output_unit","assumptions"]}'::jsonb)
) AS c(pack_slug, collection_key, collection_name, collection_description, collection_schema)
  ON c.pack_slug = p.slug
WHERE v.version = '0.1.0'
ON CONFLICT (version_id, key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schema_json = EXCLUDED.schema_json;

INSERT INTO data_pack_items (
  collection_id, item_key, title, description, unit, value_json, tags,
  source_name, source_url, source_date, region, effective_from,
  classification, applicability_notes, assumptions, advisory_status
)
SELECT c.id, i.item_key, i.title, i.description, i.unit, i.value_json, i.tags,
  i.source_name, i.source_url, i.source_date, i.region, i.effective_from,
  i.classification, i.applicability_notes, i.assumptions, i.advisory_status
FROM data_pack_collections c
JOIN data_pack_versions v ON v.id = c.version_id
JOIN data_packs p ON p.id = v.data_pack_id
JOIN (
  VALUES
    ('lados.qs-rate-library', 'rates', 'rate.concrete.grade30.supply-place', 'Grade 30 concrete supply and place reference', 'Reference rate for Grade 30 concrete supply, placing, compacting, and curing.', 'm3', '{"rate": 385, "currency": "MYR", "basis": "supply_and_place"}'::jsonb, ARRAY['concrete','structural','rate'], 'Lados Phase 19 Seed Reference', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'all-in', 'Early design and workflow testing reference only.', 'Illustrative seed value; confirm against project contract, supplier quotation, and current market rates.', 'reference_only'),
    ('lados.qs-rate-library', 'rates', 'rate.rebar.supply-fix', 'High tensile reinforcement supply, cut, bend, and fix reference', 'Reference rate for reinforcement supply, cutting, bending, and fixing.', 'kg', '{"rate": 4.8, "currency": "MYR", "basis": "supply_cut_bend_fix"}'::jsonb, ARRAY['rebar','structural','rate'], 'Lados Phase 19 Seed Reference', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'all-in', 'Tender sanity-check reference only.', 'Illustrative seed value; exclude abnormal wastage and congestion unless reviewed.', 'reference_only'),
    ('lados.boq-item-library', 'boq_items', 'boq.substructure.excavation', 'Excavate trench for foundation and dispose surplus excavated material', 'BOQ template for trench excavation with disposal note.', 'm3', '{"work_section":"Substructure","measurement_basis":"net volume measured from drawings"}'::jsonb, ARRAY['boq','substructure','earthwork'], 'Lados BOQ Template Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'template', 'Use with project-specific preambles and disposal distance.', 'Template only; not a complete contractual description until reviewed.', 'template_only'),
    ('lados.boq-item-library', 'boq_items', 'boq.concrete.slab', 'Reinforced concrete slab including placing, compacting, and curing', 'BOQ template for reinforced concrete slab measurement.', 'm3', '{"work_section":"Concrete","measurement_basis":"net concrete volume"}'::jsonb, ARRAY['boq','concrete','slab'], 'Lados BOQ Template Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'template', 'Separate formwork and reinforcement unless contract states otherwise.', 'Template only; align to project SMM/preambles.', 'template_only'),
    ('lados.claim-evidence-rules', 'claim_evidence_rules', 'claim.progress.monthly', 'Monthly progress claim minimum evidence checklist', 'Evidence checklist for preparing and reviewing monthly progress claims.', NULL::text, '{"required":["approved valuation worksheet","site photos","measurement sheets","previous certificate"],"severity":"high"}'::jsonb, ARRAY['claim','progress','evidence'], 'Lados Claim Control Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'checklist', 'Advisory checklist for claim preparation and review.', 'Does not certify entitlement or amount payable.', 'advisory_only'),
    ('lados.claim-evidence-rules', 'claim_evidence_rules', 'claim.variation.instruction', 'Variation claim evidence for instructed change', 'Evidence checklist for an instructed variation claim.', NULL::text, '{"required":["written instruction","marked-up drawing","cost build-up","programme impact note"],"severity":"high"}'::jsonb, ARRAY['claim','variation','instruction'], 'Lados Claim Control Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'checklist', 'Use with contract notice and time-bar requirements.', 'Does not decide variation validity or entitlement.', 'advisory_only'),
    ('lados.construction-standards-index', 'standards_index', 'standard.ms.concrete.reference', 'Concrete specification reference index entry', 'Reference-only index entry for concrete standards and specifications.', NULL::text, '{"publisher":"Standards Malaysia","scope_note":"Concrete materials and workmanship reference index only"}'::jsonb, ARRAY['standard','concrete','reference'], 'Lados Standards Index Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'reference_index', 'Stores reference metadata only, not copyrighted full text.', 'User must consult licensed/current standards.', 'reference_only'),
    ('lados.contractor-productivity-library', 'productivity', 'productivity.excavator.trench', 'Excavator trench excavation productivity assumption', 'Benchmark productivity assumption for trench excavation using a 20t excavator.', 'm3/day', '{"output": 95, "crew":"1 operator + banksman", "plant":"20t excavator"}'::jsonb, ARRAY['productivity','earthwork','plant'], 'Lados Productivity Seed', NULL::text, date '2026-01-01', 'MY', date '2026-01-01', 'benchmark', 'Normal access, average soil, no dewatering.', 'Adjust for ground condition, haul distance, weather, and site restrictions.', 'reference_only')
) AS i(pack_slug, collection_key, item_key, title, description, unit, value_json, tags, source_name, source_url, source_date, region, effective_from, classification, applicability_notes, assumptions, advisory_status)
  ON i.pack_slug = p.slug AND i.collection_key = c.key
WHERE v.version = '0.1.0'
ON CONFLICT (collection_id, item_key) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  value_json = EXCLUDED.value_json,
  tags = EXCLUDED.tags,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_date = EXCLUDED.source_date,
  region = EXCLUDED.region,
  effective_from = EXCLUDED.effective_from,
  classification = EXCLUDED.classification,
  applicability_notes = EXCLUDED.applicability_notes,
  assumptions = EXCLUDED.assumptions,
  advisory_status = EXCLUDED.advisory_status;

UPDATE data_pack_collections c
SET item_count = item_counts.count
FROM (
  SELECT collection_id, count(*)::integer AS count
  FROM data_pack_items
  GROUP BY collection_id
) AS item_counts
WHERE item_counts.collection_id = c.id;

COMMENT ON TABLE data_pack_versions IS 'Immutable version snapshots for governed Lados Data Packs.';
COMMENT ON TABLE data_pack_collections IS 'Logical collections inside a Data Pack version.';
COMMENT ON TABLE data_pack_items IS 'Searchable source-aware Data Pack rows consumed by workflows and node configs.';
COMMENT ON TABLE org_data_pack_installs IS 'Organization-level Data Pack install state for Phase 19.';
