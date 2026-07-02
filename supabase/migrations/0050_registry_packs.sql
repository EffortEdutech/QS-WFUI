-- ============================================================
-- Migration 0050: Phase 18 External Pack Registry
-- ============================================================
-- Creates the verified external pack catalogue used by:
--   POST /registry/packs/submit
--   GET  /registry/packs
--   POST /marketplace/registry/:listingId/install
--
-- Uploaded bundles are stored in a private Supabase Storage bucket.
-- Runtime execution of uploaded code remains disabled; install registers
-- pack metadata and manifest-declared nodes only.

CREATE TABLE IF NOT EXISTS public.registry_packs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id           text NOT NULL,
  display_name      text NOT NULL,
  description       text,
  author            text NOT NULL,
  version           text NOT NULL,
  tags              text[] NOT NULL DEFAULT '{}',
  icon              text,
  color             text,
  is_official       boolean NOT NULL DEFAULT false,
  is_verified       boolean NOT NULL DEFAULT false,
  downloads         integer NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  bundle_url        text NOT NULL,
  checksum          text NOT NULL,
  manifest_json     jsonb NOT NULL,
  published_by      uuid REFERENCES auth.users(id),
  verified_by       uuid REFERENCES auth.users(id),
  verified_at       timestamptz,
  deprecation_note  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, version)
);

CREATE INDEX IF NOT EXISTS idx_registry_packs_pack_id
  ON public.registry_packs(pack_id);

CREATE INDEX IF NOT EXISTS idx_registry_packs_verified_created
  ON public.registry_packs(is_verified, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registry_packs_tags
  ON public.registry_packs USING gin(tags);

DO $$ BEGIN
  CREATE TRIGGER set_registry_packs_updated_at
    BEFORE UPDATE ON public.registry_packs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.registry_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_read_verified_registry_packs"
  ON public.registry_packs;
DROP POLICY IF EXISTS "publishers_can_read_own_registry_packs"
  ON public.registry_packs;

CREATE POLICY "authenticated_users_can_read_verified_registry_packs"
  ON public.registry_packs FOR SELECT TO authenticated
  USING (is_verified = true);

CREATE POLICY "publishers_can_read_own_registry_packs"
  ON public.registry_packs FOR SELECT TO authenticated
  USING (published_by = (select auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lados-pack-bundles',
  'lados-pack-bundles',
  false,
  52428800,
  ARRAY[
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "authenticated_users_can_upload_lados_pack_bundles"
  ON storage.objects;
DROP POLICY IF EXISTS "authenticated_users_can_read_lados_pack_bundles"
  ON storage.objects;

CREATE POLICY "authenticated_users_can_upload_lados_pack_bundles"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lados-pack-bundles');

CREATE POLICY "authenticated_users_can_read_lados_pack_bundles"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lados-pack-bundles');
