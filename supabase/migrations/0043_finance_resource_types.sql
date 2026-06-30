-- =============================================================================
-- Migration 0043 — Phase 9: Finance Pack — Resource Types
--
-- Expands lados_resources.type CHECK constraint to include 3 finance
-- domain resource types:
--   finance_invoice    — construction IPC / interim/final payment certificate
--   purchase_order     — purchase order for materials or subcontracted services
--   retention_release  — retention money release claim at completion / DLP end
--
-- These are distinct from contractor-pack's 'invoice' and 'payment' types
-- (which track contractor service billing). Finance-pack types track
-- construction CONTRACT financial instruments (JKR/PAM/CIDB context).
--
-- No new tables required — all finance resources use the existing
-- lados_resources table with JSONB `data` for domain-specific fields.
-- =============================================================================

-- ── 1. Expand type CHECK ──────────────────────────────────────────────────────
--
-- Cumulative constraint history:
--   0027 (core):         job, fleet, worker, material, site, custom
--   0032 (contractor M1): trip, invoice, payment, customer, driver, vehicle,
--                          equipment, fuel_receipt, maintenance_record, expense
--   0034 (contractor M3): operator, payroll_run
--   0041 (construction):  construction_project, progress_claim, variation,
--                          defect, boq, site_inspection
--   0043 (finance):       finance_invoice, purchase_order, retention_release

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

    -- Finance Pack (0043 — Phase 9)
    'finance_invoice',
    'purchase_order',
    'retention_release',

    -- Escape hatch for custom integrations
    'custom'
  ));

-- ── 2. Indexes for finance resource types ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_resources_finance_parent
  ON lados_resources (parent_id, type)
  WHERE type IN ('finance_invoice', 'purchase_order', 'retention_release')
    AND parent_id IS NOT NULL;

-- ── 3. Seed lados.finance-pack in packs table ─────────────────────────────────
--
-- Seeds the pack so PackInstallerService can find it on first startup.
-- startup syncAll() handles subsequent version upserts.

INSERT INTO packs (
  id, version, display_name, description, author,
  is_official, is_enabled, status,
  dependencies, installed_from, created_at, updated_at
)
VALUES (
  'lados.finance-pack',
  '0.1.0',
  'Finance Pack',
  'Finance domain nodes — Invoice certification, Purchase Orders, Retention release (CIPAA/PAM/JKR context)',
  'Lados Platform',
  true, true, 'active',
  '["lados.foundation-pack", "lados.construction-pack"]'::jsonb,
  'startup-sync',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;
