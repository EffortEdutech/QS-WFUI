-- =============================================================================
-- Contractor Edition Test Seed
-- Phase 9 — M1–M4
--
-- Creates a ready-to-test Contractor Edition environment:
--   • 4 auth users   (owner, admin, driver1, driver2)
--   • 1 contractor organisation (Syarikat Bina Jaya Sdn Bhd)
--   • 4 org members with correct roles
--   • contractor-pack activated (is_enabled = true)
--   • Sample resources: customers, vehicles, equipment, workers, site, job, trip
--
-- Prerequisites:
--   Migrations 0001–0034 must be applied before running this seed.
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
--
-- Run in Supabase SQL Editor (postgres / service_role context).
-- =============================================================================

-- ── Fixed UUIDs ───────────────────────────────────────────────────────────────
-- Users
-- contractor-owner@lados.dev  → dddddddd-0001-0000-0000-000000000001
-- contractor-admin@lados.dev  → dddddddd-0001-0000-0000-000000000002
-- contractor-driver1@lados.dev→ dddddddd-0001-0000-0000-000000000003
-- contractor-driver2@lados.dev→ dddddddd-0001-0000-0000-000000000004
--
-- Org
-- Syarikat Bina Jaya          → eeeeeeee-0001-0000-0000-000000000001

DO $$
DECLARE
  v_owner_id   uuid := 'dddddddd-0001-0000-0000-000000000001';
  v_admin_id   uuid := 'dddddddd-0001-0000-0000-000000000002';
  v_driver1_id uuid := 'dddddddd-0001-0000-0000-000000000003';
  v_driver2_id uuid := 'dddddddd-0001-0000-0000-000000000004';
  v_org_id     uuid := 'eeeeeeee-0001-0000-0000-000000000001';

  -- Resource UUIDs
  v_customer1_id    uuid := 'aaaaaaaa-0002-0000-0000-000000000001';
  v_customer2_id    uuid := 'aaaaaaaa-0002-0000-0000-000000000002';
  v_vehicle1_id     uuid := 'aaaaaaaa-0002-0000-0000-000000000003';
  v_vehicle2_id     uuid := 'aaaaaaaa-0002-0000-0000-000000000004';
  v_equipment_id    uuid := 'aaaaaaaa-0002-0000-0000-000000000005';
  v_worker1_id      uuid := 'aaaaaaaa-0002-0000-0000-000000000006';
  v_worker2_id      uuid := 'aaaaaaaa-0002-0000-0000-000000000007';
  v_site_id         uuid := 'aaaaaaaa-0002-0000-0000-000000000008';
  v_job_id          uuid := 'aaaaaaaa-0002-0000-0000-000000000009';
  v_trip_id         uuid := 'aaaaaaaa-0002-0000-0000-000000000010';

BEGIN

-- =============================================================================
-- 1. AUTH USERS
--    Creates users directly in auth.users (requires postgres / service_role).
--    Password for all test accounts: ContractorTest1!
--    Accounts are pre-confirmed (email_confirmed_at = now()).
-- =============================================================================

  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin
  )
  VALUES
    -- Owner
    (
      v_owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'contractor-owner@lados.dev',
      crypt('ContractorTest1!', gen_salt('bf')),
      now(), '', '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Ahmad Rizal (Owner)"}',
      now(), now(), false
    ),
    -- Admin
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'contractor-admin@lados.dev',
      crypt('ContractorTest1!', gen_salt('bf')),
      now(), '', '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Siti Nora (Admin)"}',
      now(), now(), false
    ),
    -- Driver 1
    (
      v_driver1_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'contractor-driver1@lados.dev',
      crypt('ContractorTest1!', gen_salt('bf')),
      now(), '', '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Razi Hamdan (Driver)"}',
      now(), now(), false
    ),
    -- Driver 2
    (
      v_driver2_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'contractor-driver2@lados.dev',
      crypt('ContractorTest1!', gen_salt('bf')),
      now(), '', '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Farid Azman (Driver)"}',
      now(), now(), false
    )
  ON CONFLICT (id) DO NOTHING;

  -- Ensure auth.identities rows exist (required for email/password login in Supabase)
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
  )
  VALUES
    (
      v_owner_id,   v_owner_id,
      'contractor-owner@lados.dev', 'email',
      jsonb_build_object('sub', v_owner_id::text, 'email', 'contractor-owner@lados.dev'),
      now(), now(), now()
    ),
    (
      v_admin_id,   v_admin_id,
      'contractor-admin@lados.dev', 'email',
      jsonb_build_object('sub', v_admin_id::text, 'email', 'contractor-admin@lados.dev'),
      now(), now(), now()
    ),
    (
      v_driver1_id, v_driver1_id,
      'contractor-driver1@lados.dev', 'email',
      jsonb_build_object('sub', v_driver1_id::text, 'email', 'contractor-driver1@lados.dev'),
      now(), now(), now()
    ),
    (
      v_driver2_id, v_driver2_id,
      'contractor-driver2@lados.dev', 'email',
      jsonb_build_object('sub', v_driver2_id::text, 'email', 'contractor-driver2@lados.dev'),
      now(), now(), now()
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;

-- =============================================================================
-- 2. ORGANISATION
-- =============================================================================

  INSERT INTO organizations (id, name, slug, logo_url)
  VALUES (
    v_org_id,
    'Syarikat Bina Jaya Sdn Bhd',
    'bina-jaya',
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- =============================================================================
-- 3. ORG MEMBERS
-- =============================================================================

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES
    (v_org_id, v_owner_id,   'owner'),
    (v_org_id, v_admin_id,   'admin'),
    (v_org_id, v_driver1_id, 'driver'),
    (v_org_id, v_driver2_id, 'driver')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

-- =============================================================================
-- 4. ACTIVATE CONTRACTOR-PACK
--    PackInstallerService.syncAll() runs on API startup and upserts this row.
--    This UPDATE ensures it is enabled even before the first API restart.
-- =============================================================================

  UPDATE packs
  SET is_enabled = true, status = 'active'
  WHERE id = 'lados.contractor-pack';

  -- Also ensure foundation-pack is active (contractor-pack depends on it)
  UPDATE packs
  SET is_enabled = true, status = 'active'
  WHERE id = 'lados.foundation-pack';

-- =============================================================================
-- 5. SEED RESOURCES
--    Demonstrates the full Contractor Edition data model:
--    customers → vehicles / equipment / workers → site → job → trip
-- =============================================================================

  -- ── Customers ──────────────────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_customer1_id, v_org_id,
      'customer', 'Pembinaan Maju Jaya Sdn Bhd', 'active',
      '{"contactPerson":"En. Kamal","phone":"012-3456789","email":"kamal@pmj.com.my","address":"Lot 5, Jalan Industri 3, Shah Alam","creditLimit":50000}',
      v_owner_id
    ),
    (
      v_customer2_id, v_org_id,
      'customer', 'Projek Bersatu Holdings', 'active',
      '{"contactPerson":"Pn. Lina","phone":"013-9876543","email":"lina@pb-holdings.com","address":"Unit 12, Menara Projek, KL","creditLimit":80000}',
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Vehicles ───────────────────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_vehicle1_id, v_org_id,
      'vehicle', 'Lorry BJA-1234', 'available',
      '{"plateNumber":"BJA 1234","vehicleType":"lorry","make":"Hino","model":"500 Series","year":2020,"capacity":"10 tan","lastServiceDate":"2025-12-01"}',
      v_owner_id
    ),
    (
      v_vehicle2_id, v_org_id,
      'vehicle', 'Dump Truck BJA-5678', 'available',
      '{"plateNumber":"BJA 5678","vehicleType":"dump_truck","make":"Mitsubishi","model":"Fighter","year":2019,"capacity":"14 tan","lastServiceDate":"2025-11-15"}',
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Equipment ──────────────────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_equipment_id, v_org_id,
      'equipment', 'Excavator CAT-320', 'available',
      '{"serialNumber":"CAT320-2021-007","make":"Caterpillar","model":"320","year":2021,"hourlyRate":350,"lastServiceHours":1200}',
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Workers (drivers as worker resources) ─────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_worker1_id, v_org_id,
      'worker', 'Razi Hamdan', 'available',
      '{"icNumber":"850312-10-1234","phone":"011-1234567","licenseClass":"E","dailyRate":120,"linkedUserId":"dddddddd-0001-0000-0000-000000000003"}',
      v_owner_id
    ),
    (
      v_worker2_id, v_org_id,
      'worker', 'Farid Azman', 'available',
      '{"icNumber":"880601-14-5678","phone":"011-9876543","licenseClass":"E","dailyRate":120,"linkedUserId":"dddddddd-0001-0000-0000-000000000004"}',
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Site ──────────────────────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_site_id, v_org_id,
      'site', 'Tapak Projek Sri Permai', 'active',
      '{"address":"Lot 22, Persiaran Industri, Rawang, Selangor","gpsLat":3.3195,"gpsLng":101.5753,"siteContact":"En. Rashid 013-1112233"}',
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Job ───────────────────────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, created_by)
  VALUES
    (
      v_job_id, v_org_id,
      'job', 'JOB-2026-001 — Earthworks Sri Permai', 'active',
      jsonb_build_object(
        'customerId',    v_customer1_id,
        'siteId',        v_site_id,
        'description',   'Earthworks and soil compaction for residential development Phase 1',
        'startDate',     '2026-06-23',
        'endDate',       '2026-08-31',
        'quotedAmount',  45000,
        'currency',      'MYR',
        'poNumber',      'PMJ-PO-2026-044'
      ),
      v_owner_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── Trip (child of Job) ───────────────────────────────────────────────────
  INSERT INTO lados_resources (id, org_id, type, name, state, data, parent_id, created_by)
  VALUES
    (
      v_trip_id, v_org_id,
      'trip', 'TRIP-2026-001-001', 'dispatched',
      jsonb_build_object(
        'jobId',         v_job_id,
        'vehicleId',     v_vehicle1_id,
        'driverId',      v_worker1_id,
        'loadType',      'earth',
        'loadQuantity',  10,
        'loadUnit',      'tan',
        'origin',        'Tapak Sri Permai',
        'destination',   'Pusat Pelupusan Rawang',
        'dispatchedAt',  now()
      ),
      v_job_id,
      v_driver1_id
    )
  ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. AUDIT LOG
-- =============================================================================

  INSERT INTO audit_log (
    organization_id, actor_id, event_type,
    entity_type, entity_id, summary
  )
  VALUES (
    v_org_id, v_owner_id,
    'seed.contractor_edition',
    'organization', v_org_id,
    'Contractor Edition seed applied — Syarikat Bina Jaya, 4 users, contractor-pack activated, sample resources created.'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Contractor Edition seed complete.';
  RAISE NOTICE '  Org:   Syarikat Bina Jaya Sdn Bhd (%)', v_org_id;
  RAISE NOTICE '  Login: contractor-owner@lados.dev  /  ContractorTest1!';
  RAISE NOTICE '         contractor-admin@lados.dev  /  ContractorTest1!';
  RAISE NOTICE '         contractor-driver1@lados.dev / ContractorTest1!';
  RAISE NOTICE '         contractor-driver2@lados.dev / ContractorTest1!';
  RAISE NOTICE '  Pack:  lados.contractor-pack → activated';
  RAISE NOTICE '  Resources: 2 customers, 2 vehicles, 1 equipment,';
  RAISE NOTICE '             2 workers, 1 site, 1 job, 1 trip (dispatched)';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'After running: restart the API to trigger PackInstaller.syncAll()';
  RAISE NOTICE 'Then click Sync on /packs to confirm contractor-pack is active.';

END $$;
