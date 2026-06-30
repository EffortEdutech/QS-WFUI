-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003: Workflows + Workflow Versions
-- QS-OS V2 (QS-WFUI) — Sprint 2
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Workflows ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflows (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'archived')),
  -- Current live definition (Workflow JSON — schemaVersion 1.0)
  definition      JSONB       NOT NULL DEFAULT '{"schemaVersion":"1.0","nodes":[],"connections":[]}'::jsonb,
  -- Semantic version string e.g. "1.0.0"
  version         TEXT        NOT NULL DEFAULT '1.0.0',
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflows IS 'A visual workflow definition belonging to a project. definition stores the live Workflow JSON.';
COMMENT ON COLUMN public.workflows.definition IS 'Canonical Workflow JSON (schemaVersion 1.0). Validated by @lados/workflow-json before write.';

-- ── Workflow versions (immutable snapshots) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version     TEXT        NOT NULL,
  definition  JSONB       NOT NULL,
  change_note TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflow_versions IS 'Immutable snapshots of a workflow at a point in time. Created on publish.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workflows_project_id
  ON public.workflows(project_id);

CREATE INDEX IF NOT EXISTS idx_workflows_status
  ON public.workflows(status);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id
  ON public.workflow_versions(workflow_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE TRIGGER workflows_set_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

-- Org members can see workflows in their projects
CREATE POLICY "workflows_select_org_members"
  ON public.workflows FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "workflows_insert_members"
  ON public.workflows FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "workflows_update_members"
  ON public.workflows FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "workflows_delete_admin"
  ON public.workflows FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Workflow versions follow the same access as the parent workflow
CREATE POLICY "workflow_versions_select"
  ON public.workflow_versions FOR SELECT
  USING (
    workflow_id IN (
      SELECT w.id FROM public.workflows w
      JOIN public.projects p ON p.id = w.project_id
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "workflow_versions_insert_members"
  ON public.workflow_versions FOR INSERT
  WITH CHECK (
    workflow_id IN (
      SELECT w.id FROM public.workflows w
      JOIN public.projects p ON p.id = w.project_id
      JOIN public.organization_members om ON om.organization_id = p.organization_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'member')
    )
  );
