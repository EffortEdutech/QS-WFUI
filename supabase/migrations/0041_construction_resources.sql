-- =============================================================================
-- Migration 0041 — Phase 7: Construction Pack — Resource Types
--
-- Expands lados_resources.type CHECK constraint to include 6 construction
-- domain resource types:
--   construction_project  — master project record (BOQ, timeline, contract value)
--   progress_claim        — interim/final payment application by contractor
--   variation             — contract variation / VO (change order)
--   defect                — site defect / non-conformance record
--   boq                   — Bill of Quantities document
--   site_inspection       — site inspection / quality check record
--
-- No new tables required — all construction resources use the existing
-- lados_resources table with JSONB `data` for domain-specific fields.
-- =============================================================================

-- ── 1. Expand type CHECK ──────────────────────────────────────────────────────
--
-- Cumulative constraint history:
--   0027 (core):    job, fleet, worker, material, site, custom
--   0032 (phase 9): + trip, invoice, payment, customer, driver, vehicle,
--                     equipment, fuel_receipt, maintenance_record, expense
--   0034 (M3/M4):  + operator, payroll_run
--   0041 (phase 7): + construction_project, progress_claim, variation,
--                     defect, boq, site_inspection

ALTER TABLE lados_resources
  DROP CONSTRAINT IF EXISTS lados_resources_type_check;

ALTER TABLE lados_resources
  ADD CONSTRAINT lados_resources_type_check
  CHECK (type IN (
    -- Core resource types (0027)
    'job', 'fleet', 'worker', 'material', 'site',

    -- Contractor Edition M1-M2 (0032)
    'trip', 'invoice', 'payment',
    'customer', 'driver', 'vehicle', 'equipment',
    'fuel_receipt', 'maintenance_record', 'expense',

    -- Contractor Edition M3-M4 (0034)
    'operator', 'payroll_run',

    -- Construction Pack (0041 — Phase 7)
    'construction_project',
    'progress_claim',
    'variation',
    'defect',
    'boq',
    'site_inspection',

    -- Escape hatch for custom integrations
    'custom'
  ));

-- ── 2. Indexes for construction resource types ────────────────────────────────
--
-- The existing idx_resources_org_type covers (org_id, type) for all types,
-- so no new composite index needed. Adding a partial index on parent_id for
-- progress claims / variations / defects that are children of a project.

CREATE INDEX IF NOT EXISTS idx_resources_construction_parent
  ON lados_resources (parent_id, type)
  WHERE type IN ('progress_claim', 'variation', 'defect', 'boq', 'site_inspection')
    AND parent_id IS NOT NULL;

-- ── 3. Seed lados-construction-pack in packs table ──────────────────────────
--
-- Seeds the pack at install time so PackInstallerService can enable it.
-- Uses ON CONFLICT DO NOTHING — startup syncAll() handles subsequent upserts.

INSERT INTO packs (
  id, version, display_name, description, author,
  is_official, is_enabled, status,
  dependencies, installed_from, created_at, updated_at
)
VALUES (
  'lados.construction-pack',
  '0.1.0',
  'Construction Pack',
  'Construction domain nodes — Projects, Progress Claims, Variations, Defects, BOQ, Site Inspections',
  'Lados Platform',
  true, true, 'active',
  '["lados.foundation-pack"]'::jsonb,
  'startup-sync',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;
