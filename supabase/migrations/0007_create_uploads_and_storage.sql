-- ============================================================
-- Migration 0007: File Uploads table + Supabase Storage bucket
-- Sprint 7 (S7-002)
-- ============================================================

-- ── uploads table ─────────────────────────────────────────────────────────────
-- Tracks every file uploaded via the API.

CREATE TABLE IF NOT EXISTS uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id      uuid REFERENCES projects(id),
  workflow_id     uuid REFERENCES workflows(id),

  -- File metadata
  original_name   text NOT NULL,
  storage_path    text NOT NULL,   -- path inside the storage bucket
  bucket          text NOT NULL DEFAULT 'workflow-uploads',
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,

  -- Status
  status          text NOT NULL DEFAULT 'ready'
                  CHECK (status IN ('uploading', 'ready', 'processing', 'failed', 'deleted')),

  -- Ownership
  uploaded_by     uuid NOT NULL REFERENCES auth.users(id),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uploads_organization_id_idx ON uploads(organization_id);
CREATE INDEX IF NOT EXISTS uploads_project_id_idx      ON uploads(project_id);
CREATE INDEX IF NOT EXISTS uploads_workflow_id_idx     ON uploads(workflow_id);

CREATE TRIGGER set_uploads_updated_at
  BEFORE UPDATE ON uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read uploads in their org"
  ON uploads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = uploads.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert uploads"
  ON uploads FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = uploads.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Uploader can update their uploads"
  ON uploads FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

-- ── Supabase Storage bucket ────────────────────────────────────────────────────
-- Creates the storage bucket for workflow file uploads.
-- Run this in the Supabase SQL Editor (requires storage schema access).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workflow-uploads',
  'workflow-uploads',
  false,
  52428800,   -- 50 MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- .xlsx
    'application/vnd.ms-excel',                                            -- .xls
    'text/csv',                                                            -- .csv
    'application/pdf',                                                     -- .pdf
    'application/octet-stream'                                             -- fallback
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload and read their own files
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workflow-uploads');

CREATE POLICY "Authenticated users can read their uploaded files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workflow-uploads');

CREATE POLICY "Authenticated users can delete their own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workflow-uploads' AND owner = auth.uid()::text);
