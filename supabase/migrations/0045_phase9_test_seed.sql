-- =============================================================================
-- Migration 0045 — Phase 9 Test Seed (self-contained)
--
-- Includes schema prerequisites from 0043 + 0044 so this file can be run
-- standalone without needing 0043/0044 applied first.
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING; constraint is
-- always replaced idempotently.
-- =============================================================================

-- ── 1. Expand type CHECK constraint (from 0043) ───────────────────────────────

ALTER TABLE lados_resources
  DROP CONSTRAINT IF EXISTS lados_resources_type_check;

ALTER TABLE lados_resources
  ADD CONSTRAINT lados_resources_type_check
  CHECK (type IN (
    -- Core (0027)
    'job', 'fleet', 'worker', 'material', 'site',
    -- Contractor M1-M2 (0032)
    'trip', 'invoice', 'payment',
    'customer', 'driver', 'vehicle', 'equipment',
    'fuel_receipt', 'maintenance_record', 'expense',
    -- Contractor M3-M4 (0034)
    'operator', 'payroll_run',
    -- Construction Pack (0041)
    'construction_project', 'progress_claim', 'variation',
    'defect', 'boq', 'site_inspection',
    -- Finance Pack (0043)
    'finance_invoice', 'purchase_order', 'retention_release',
    -- Escape hatch
    'custom'
  ));

CREATE INDEX IF NOT EXISTS idx_resources_finance_parent
  ON lados_resources (parent_id, type)
  WHERE type IN ('finance_invoice', 'purchase_order', 'retention_release')
    AND parent_id IS NOT NULL;

-- ── 2. Seed lados.finance-pack in packs table (from 0043) ────────────────────

INSERT INTO packs (
  id, version, display_name, description, author,
  is_official, is_enabled, status,
  dependencies, installed_from, created_at, updated_at
)
VALUES (
  'lados.finance-pack', '0.1.0', 'Finance Pack',
  'Finance domain nodes — Invoice certification, Purchase Orders, Retention release (CIPAA/PAM/JKR context)',
  'Lados Platform', true, true, 'active',
  '["lados.foundation-pack", "lados.construction-pack"]'::jsonb,
  'startup-sync', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Finance state machines (from 0044) ─────────────────────────────────────

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'finance_invoice', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray"   },
    "submitted": { "label": "Submitted", "terminal": false, "color": "blue"   },
    "verified":  { "label": "Verified",  "terminal": false, "color": "indigo" },
    "approved":  { "label": "Approved",  "terminal": false, "color": "green"  },
    "paid":      { "label": "Paid",      "terminal": true,  "color": "emerald"},
    "rejected":  { "label": "Rejected",  "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",     "to": "submitted", "label": "Submit for Verification"  },
    { "from": "submitted", "to": "verified",  "label": "QS Verify"                },
    { "from": "submitted", "to": "rejected",  "label": "Reject Invoice"            },
    { "from": "verified",  "to": "approved",  "label": "PM Approve (Human)"        },
    { "from": "verified",  "to": "rejected",  "label": "Reject after Verification" },
    { "from": "approved",  "to": "paid",      "label": "Process Payment (Human)"   }
  ]
}')
ON CONFLICT DO NOTHING;

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'purchase_order', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray"   },
    "submitted": { "label": "Submitted", "terminal": false, "color": "blue"   },
    "approved":  { "label": "Approved",  "terminal": false, "color": "green"  },
    "issued":    { "label": "Issued",    "terminal": false, "color": "indigo" },
    "fulfilled": { "label": "Fulfilled", "terminal": true,  "color": "emerald"},
    "rejected":  { "label": "Rejected",  "terminal": true,  "color": "red"    },
    "cancelled": { "label": "Cancelled", "terminal": true,  "color": "gray"   }
  },
  "transitions": [
    { "from": "draft",     "to": "submitted", "label": "Submit PO"          },
    { "from": "submitted", "to": "approved",  "label": "Approve PO (Human)" },
    { "from": "submitted", "to": "rejected",  "label": "Reject PO"          },
    { "from": "approved",  "to": "issued",    "label": "Issue to Supplier"  },
    { "from": "approved",  "to": "cancelled", "label": "Cancel before Issue"},
    { "from": "issued",    "to": "fulfilled", "label": "Mark Fulfilled"     },
    { "from": "issued",    "to": "cancelled", "label": "Cancel after Issue" }
  ]
}')
ON CONFLICT DO NOTHING;

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'retention_release', '{
  "initial": "pending",
  "states": {
    "pending":  { "label": "Pending",  "terminal": false, "color": "gray"   },
    "claimed":  { "label": "Claimed",  "terminal": false, "color": "blue"   },
    "approved": { "label": "Approved", "terminal": false, "color": "green"  },
    "released": { "label": "Released", "terminal": true,  "color": "emerald"},
    "rejected": { "label": "Rejected", "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "pending",  "to": "claimed",  "label": "Claim Retention"         },
    { "from": "claimed",  "to": "approved", "label": "Approve Release (Human)" },
    { "from": "claimed",  "to": "rejected", "label": "Reject Claim"            },
    { "from": "approved", "to": "released", "label": "Release Payment (Human)" }
  ]
}')
ON CONFLICT DO NOTHING;

-- ── 4. Test seed data ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id       UUID;
  v_user_id      UUID;
  v_project_id   UUID;
  v_invoice_id   UUID;
  v_po_id        UUID;
  v_retention_id UUID;
BEGIN

  -- Discover org
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found — create one in the app first';
  END IF;

  -- Discover owner/admin user (no created_at on organization_members)
  SELECT user_id INTO v_user_id
  FROM   organization_members
  WHERE  organization_id = v_org_id
    AND  role IN ('owner', 'admin')
  LIMIT  1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No owner/admin member found in org %', v_org_id;
  END IF;

  -- Test project (idempotent by code P9-TEST)
  SELECT id INTO v_project_id
  FROM   projects
  WHERE  organization_id = v_org_id AND code = 'P9-TEST'
  LIMIT  1;

  IF v_project_id IS NULL THEN
    INSERT INTO projects (name, code, organization_id, description, created_by)
    VALUES ('Phase9 Test Project', 'P9-TEST', v_org_id,
            'Seed data for Phase 9 Finance pack E2E test', v_user_id)
    RETURNING id INTO v_project_id;
    RAISE NOTICE 'Created project %', v_project_id;
  ELSE
    RAISE NOTICE 'Reusing existing project %', v_project_id;
  END IF;

  -- Finance Invoice
  INSERT INTO lados_resources (org_id, project_id, type, name, state, data, created_by)
  VALUES (
    v_org_id, v_project_id, 'finance_invoice', 'Test Invoice INV-SEED-001', 'draft',
    jsonb_build_object(
      'invoice_number',   'INV-SEED-001',
      'contractor_name',  'Test Contractor Sdn Bhd',
      'contract_ref',     'CONTRACT-PAM-001',
      'period_from',      '2026-06-01',
      'period_to',        '2026-06-30',
      'line_items', jsonb_build_array(
        jsonb_build_object('description','Earthworks — cut & fill','quantity',100,'unit','m3','unit_rate',25.00,'amount',2500.00),
        jsonb_build_object('description','Concrete Grade 30','quantity',50,'unit','m3','unit_rate',280.00,'amount',14000.00)
      ),
      'subtotal', 16500.00, 'retention_rate', 0.05,
      'retention_amount', 825.00, 'net_amount', 15675.00, 'currency', 'MYR'
    ),
    v_user_id
  )
  RETURNING id INTO v_invoice_id;
  RAISE NOTICE 'Created finance_invoice %  (INV-SEED-001)', v_invoice_id;

  -- Purchase Order
  INSERT INTO lados_resources (org_id, project_id, type, name, state, data, created_by)
  VALUES (
    v_org_id, v_project_id, 'purchase_order', 'Test PO PO-SEED-001', 'draft',
    jsonb_build_object(
      'po_number', 'PO-SEED-001', 'supplier_name', 'Seed Supplier Sdn Bhd',
      'contract_ref', 'CONTRACT-PAM-001',
      'line_items', jsonb_build_array(
        jsonb_build_object('description','Structural Steel — H-beam','quantity',10,'unit','tonne','unit_rate',3500.00,'amount',35000.00)
      ),
      'total_amount', 35000.00, 'currency', 'MYR', 'delivery_date', '2026-07-31'
    ),
    v_user_id
  )
  RETURNING id INTO v_po_id;
  RAISE NOTICE 'Created purchase_order %  (PO-SEED-001)', v_po_id;

  -- Retention Release
  INSERT INTO lados_resources (org_id, project_id, type, name, state, data, created_by)
  VALUES (
    v_org_id, v_project_id, 'retention_release', 'Test Retention Release RR-SEED-001', 'pending',
    jsonb_build_object(
      'release_number', 'RR-SEED-001', 'contractor_name', 'Test Contractor Sdn Bhd',
      'contract_ref', 'CONTRACT-PAM-001',
      'retention_amount', 50000.00, 'release_type', 'half',
      'release_amount', 25000.00, 'currency', 'MYR',
      'practical_completion_date', '2026-05-15'
    ),
    v_user_id
  )
  RETURNING id INTO v_retention_id;
  RAISE NOTICE 'Created retention_release %  (RR-SEED-001)', v_retention_id;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=== Phase 9 Test Seed Complete ===';
  RAISE NOTICE 'org_id:        %', v_org_id;
  RAISE NOTICE 'user_id:       %', v_user_id;
  RAISE NOTICE 'project_id:    %', v_project_id;
  RAISE NOTICE 'invoice_id:    %', v_invoice_id;
  RAISE NOTICE 'po_id:         %', v_po_id;
  RAISE NOTICE 'retention_id:  %', v_retention_id;
  RAISE NOTICE 'Copy these IDs into test_phase9.ps1 before running the tests.';

END $$;
