-- ============================================================
-- Migration 0033: Workflow Artifacts
-- Phase 9 Correction — LCE V1
--
-- Artifacts are named, project-scoped data stores that persist
-- across workflow run boundaries. They are the mechanism by which
-- one workflow passes structured output to another within the
-- same project — without hardcoded resource ID coupling.
--
-- See docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md §4.10
-- ============================================================

-- ── Main artifacts table ──────────────────────────────────────────────────────

create table if not exists lados_artifacts (
  id              uuid        primary key default gen_random_uuid(),
  organisation_id uuid        not null references organizations(id) on delete cascade,
  project_id      uuid        not null references projects(id)      on delete cascade,

  -- Lineage: which workflow/run last wrote this artifact
  workflow_id     uuid        references workflows(id) on delete set null,
  run_id          uuid        references execution_runs(id) on delete set null,

  -- Key is the addressable name within the project scope
  -- e.g. "current_job", "last_invoice", "trip_batch_2026_06"
  artifact_key    text        not null,

  artifact_type   text        not null default 'json'
                  check (artifact_type in ('json', 'text', 'file')),

  -- Payload — one of these is populated depending on artifact_type
  data            jsonb,      -- for json and text artifacts
  file_url        text,       -- for file artifacts (Supabase Storage URL)

  -- Version increments on every write — enables optimistic concurrency checks
  version         integer     not null default 1,

  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One live artifact per key per project
  -- Writes are upserts that increment version and update updated_at
  unique (project_id, artifact_key)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_lados_artifacts_project
  on lados_artifacts (project_id);

create index if not exists idx_lados_artifacts_org
  on lados_artifacts (organisation_id);

create index if not exists idx_lados_artifacts_workflow
  on lados_artifacts (workflow_id);

-- ── Version history table (append-only, never updated) ───────────────────────
-- Records every write so artifact history is auditable.

create table if not exists lados_artifact_versions (
  id              uuid        primary key default gen_random_uuid(),
  artifact_id     uuid        not null references lados_artifacts(id) on delete cascade,
  project_id      uuid        not null,
  artifact_key    text        not null,
  version         integer     not null,
  artifact_type   text        not null,
  data            jsonb,
  file_url        text,
  workflow_id     uuid,
  run_id          uuid,
  written_by      uuid        references auth.users(id) on delete set null,
  written_at      timestamptz not null default now()
);

create index if not exists idx_lados_artifact_versions_artifact
  on lados_artifact_versions (artifact_id, version desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table lados_artifacts         enable row level security;
alter table lados_artifact_versions enable row level security;

-- Org members can read artifacts belonging to their org
create policy "org members can read artifacts"
  on lados_artifacts for select
  using (
    exists (
      select 1 from organization_members
      where organization_members.organization_id = lados_artifacts.organisation_id
        and organization_members.user_id = auth.uid()
    )
  );

create policy "org members can read artifact versions"
  on lados_artifact_versions for select
  using (
    exists (
      select 1 from lados_artifacts a
        join organization_members m on m.organization_id = a.organisation_id
      where a.id = lados_artifact_versions.artifact_id
        and m.user_id = auth.uid()
    )
  );

-- Service role has full access (used by API)
create policy "service role full access artifacts"
  on lados_artifacts for all
  using (auth.role() = 'service_role');

create policy "service role full access artifact versions"
  on lados_artifact_versions for all
  using (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function update_lados_artifacts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_lados_artifacts_updated_at
  before update on lados_artifacts
  for each row execute function update_lados_artifacts_updated_at();
