-- ============================================================
-- Migration 0008: Project Document Library (project_files)
-- Sprint 8 (S8-001)
-- ============================================================
-- Stores files uploaded once to a project library.
-- Nodes reference files by id (library_file_id in config)
-- rather than uploading at run time.
-- ============================================================

CREATE TABLE IF NOT EXISTS project_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id      uuid REFERENCES projects(id),   -- NULL = org-wide

  -- Human-facing metadata
  label           text NOT NULL,                  -- e.g. "Hospital B BOQ v3"
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('boq', 'spec', 'drawing', 'schedule', 'other')),

  -- Storage
  original_name   text NOT NULL,
  storage_path    text NOT NULL,                  -- path inside workflow-uploads bucket
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,

  -- Ownership
  uploaded_by     uuid NOT NULL REFERENCES auth.users(id),

  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz                     -- soft-delete
);

CREATE INDEX IF NOT EXISTS project_files_org_idx     ON project_files(organization_id);
CREATE INDEX IF NOT EXISTS project_files_project_idx ON project_files(project_id);
CREATE INDEX IF NOT EXISTS project_files_category_idx ON project_files(organization_id, category);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read project files"   ON project_files;
DROP POLICY IF EXISTS "Members can insert project files" ON project_files;
DROP POLICY IF EXISTS "Uploader can delete project files" ON project_files;

CREATE POLICY "Members can read project files"
  ON project_files FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = project_files.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert project files"
  ON project_files FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = project_files.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Uploader can soft-delete project files"
  ON project_files FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());
