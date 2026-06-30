-- =============================================================================
-- Migration 0011 — Sprint 11: Project Pipeline + Artifacts
-- =============================================================================
-- Creates:
--   project_pipelines  — one pipeline layout per project (React Flow JSON)
--   project_artifacts  — key-value artifact store for inter-workflow data handoff
-- =============================================================================

-- ---------------------------------------------------------------------------
-- project_pipelines
-- Stores the React Flow node/edge layout for the project pipeline canvas.
-- One row per project (UNIQUE constraint). Upserted on every canvas save.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_pipelines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  layout      jsonb       NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_pipelines_project_id_key UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_pipelines_project
  ON public.project_pipelines (project_id);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_pipelines_updated_at ON public.project_pipelines;
CREATE TRIGGER trg_project_pipelines_updated_at
  BEFORE UPDATE ON public.project_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.project_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_select" ON public.project_pipelines
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "pipeline_insert" ON public.project_pipelines
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "pipeline_update" ON public.project_pipelines
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- project_artifacts
-- Key-value store scoped to a project for inter-workflow data handoff.
-- project.save_artifact nodes write here; project.read_artifact nodes read.
-- UNIQUE(project_id, artifact_key) — upsert semantics.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_artifacts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_workflow_id   uuid        REFERENCES public.workflows(id) ON DELETE SET NULL,
  execution_run_id     uuid        REFERENCES public.execution_runs(id) ON DELETE SET NULL,
  artifact_key         text        NOT NULL,
  value                jsonb       NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_artifacts_project_key UNIQUE (project_id, artifact_key)
);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_project
  ON public.project_artifacts (project_id);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_key
  ON public.project_artifacts (project_id, artifact_key);

DROP TRIGGER IF EXISTS trg_project_artifacts_updated_at ON public.project_artifacts;
CREATE TRIGGER trg_project_artifacts_updated_at
  BEFORE UPDATE ON public.project_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artifact_select" ON public.project_artifacts
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "artifact_insert" ON public.project_artifacts
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "artifact_update" ON public.project_artifacts
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypasses RLS (used by real nodes writing artifacts)
CREATE POLICY "artifact_service_all" ON public.project_artifacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "pipeline_service_all" ON public.project_pipelines
  FOR ALL USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Register new Pipeline pack nodes
-- ---------------------------------------------------------------------------
INSERT INTO public.registered_nodes
  (type, pack_id, name, description, version, category, icon, color, tags, inputs, outputs, config_schema, ui_schema)
VALUES
(
  'project.save_artifact',
  'lados.core-pack',
  'Save Artifact',
  'Save workflow outputs to the project artifact store so downstream workflows can read them.',
  '1.0.0',
  'Pipeline',
  'upload-cloud',
  '#0EA5E9',
  ARRAY['pipeline', 'artifact', 'handoff'],
  '[]'::jsonb,
  '[{"id":"saved","label":"Saved","type":"boolean"},{"id":"artifact_key","label":"Artifact Key","type":"string"},{"id":"keys_saved","label":"Keys Saved","type":"json"}]'::jsonb,
  '[{"id":"artifact_key","label":"Artifact Key","type":"text","required":true,"placeholder":"e.g. rfq_package"},{"id":"include_keys","label":"Include Keys","type":"text","required":false,"placeholder":"Leave empty to save all inputs"}]'::jsonb,
  '{"title":"Save Artifact","category":"Pipeline","color":"#0EA5E9","description":"Save outputs to project artifact store."}'::jsonb
),
(
  'project.read_artifact',
  'lados.core-pack',
  'Read Artifact',
  'Read a saved artifact from the project store into this workflow as inputs.',
  '1.0.0',
  'Pipeline',
  'download-cloud',
  '#0EA5E9',
  ARRAY['pipeline', 'artifact', 'handoff'],
  '[]'::jsonb,
  '[{"id":"_artifact_key","label":"Artifact Key","type":"string"},{"id":"_artifact_loaded_at","label":"Loaded At","type":"string"}]'::jsonb,
  '[{"id":"artifact_key","label":"Artifact Key","type":"text","required":true,"placeholder":"e.g. rfq_package"}]'::jsonb,
  '{"title":"Read Artifact","category":"Pipeline","color":"#0EA5E9","description":"Read artifact from project store into workflow."}'::jsonb
)
ON CONFLICT (type) DO NOTHING;
