-- ============================================================
-- QS-OS MVP Demo Seed
-- Sprint 10 (S10-003)
--
-- Creates a ready-to-run demo environment.
-- Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE.
--
-- Run in Supabase SQL Editor after migrations 0001–0010.
-- ============================================================

-- ── 1. Demo Auth User ────────────────────────────────────────────────────────
-- NOTE: Create the demo user via Supabase Auth UI or API first.
-- Then paste the returned UUID below as DEMO_USER_ID.
-- Default: we use a placeholder that you replace.

DO $$
DECLARE
  v_org_id    uuid;
  v_project_id uuid;
  v_workflow_id uuid;
  v_user_id   uuid;
BEGIN

  -- ── Resolve demo user ──────────────────────────────────────────────────────
  -- Replace this with your actual demo user UUID from auth.users.
  -- Or run: SELECT id FROM auth.users WHERE email = 'demo@qs-os.com' LIMIT 1;
  v_user_id := (
    SELECT id FROM auth.users WHERE email = 'demo@qs-os.com' LIMIT 1
  );

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Demo user demo@qs-os.com not found — create via Supabase Auth first, then re-run seed.';
    RETURN;
  END IF;

  -- ── 2. Demo Organisation ──────────────────────────────────────────────────
  INSERT INTO organizations (id, name, slug, plan, owner_id)
  VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'Hospital Projek Sdn Bhd (Demo)',
    'hospital-projek-demo',
    'pro',
    v_user_id
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

  v_org_id := 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  -- ── 3. Demo Project ───────────────────────────────────────────────────────
  INSERT INTO projects (id, organization_id, name, description, code, status, created_by)
  VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    v_org_id,
    'Hospital Baru — Block B Structural Works',
    'Demo project: BOQ-to-RFQ workflow for structural and M&E works.',
    'HB-BLOCK-B',
    'active',
    v_user_id
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  v_project_id := 'bbbbbbbb-0000-0000-0000-000000000001'::uuid;

  -- ── 4. Demo Workflow (from BOQ-to-RFQ template definition) ───────────────
  INSERT INTO workflows (id, project_id, organization_id, name, description, status, definition, created_by)
  SELECT
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    v_project_id,
    v_org_id,
    'BOQ to RFQ — Hospital Block B',
    'AI-assisted BOQ classification and RFQ document generation for contractor tendering.',
    'draft',
    wt.definition,
    v_user_id
  FROM workflow_templates wt
  WHERE wt.slug = 'boq-to-rfq'
  LIMIT 1
  ON CONFLICT (id) DO UPDATE SET
    name       = EXCLUDED.name,
    definition = EXCLUDED.definition;

  v_workflow_id := 'cccccccc-0000-0000-0000-000000000001'::uuid;

  -- ── 5. Demo project_file entry ────────────────────────────────────────────
  -- Points to the Hospital_B_BOQ.xlsx already uploaded in Sprint 7.
  -- If the file is not yet in storage, the Read BOQ node will fail gracefully.
  INSERT INTO project_files (
    project_id, organization_id, uploaded_by,
    name, original_name, file_type, mime_type,
    storage_path, size_bytes, status
  )
  VALUES (
    v_project_id, v_org_id, v_user_id,
    'Hospital_B_BOQ.xlsx', 'Hospital_B_BOQ.xlsx',
    'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'workflow-uploads/demo/Hospital_B_BOQ.xlsx',
    0,   -- size unknown until actual file is uploaded
    'ready'
  )
  ON CONFLICT DO NOTHING;

  -- ── 6. Audit log ──────────────────────────────────────────────────────────
  INSERT INTO audit_log (organization_id, project_id, actor_id, event_type, entity_type, entity_id, summary)
  VALUES (
    v_org_id, v_project_id, v_user_id,
    'demo.seed_applied', 'project', v_project_id,
    'Demo seed applied — organisation, project, and BOQ-to-RFQ workflow created.'
  );

  RAISE NOTICE 'Demo seed complete. Org: %, Project: %, Workflow: %',
    v_org_id, v_project_id, v_workflow_id;

END $$;
