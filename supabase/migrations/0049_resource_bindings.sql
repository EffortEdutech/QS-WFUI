-- Resource bindings: governed workflow node -> resource indirection.
-- Note: 0046 is already used by a workflow node rename migration in this repo.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists resource_bindings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  node_id text not null,
  binding_key text not null,
  resource_id uuid not null,
  resource_type text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workflow_id, node_id, binding_key)
);

create index if not exists idx_resource_bindings_workflow
  on resource_bindings (workflow_id);

create index if not exists idx_resource_bindings_org
  on resource_bindings (org_id);

create index if not exists idx_resource_bindings_resource
  on resource_bindings (resource_id);

drop trigger if exists set_resource_bindings_updated_at on resource_bindings;
create trigger set_resource_bindings_updated_at
  before update on resource_bindings
  for each row execute function public.set_updated_at();

alter table resource_bindings enable row level security;

drop policy if exists "org members can read bindings" on resource_bindings;
create policy "org members can read bindings"
  on resource_bindings for select
  using (
    org_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "org members can write bindings" on resource_bindings;
create policy "org members can write bindings"
  on resource_bindings for all
  using (
    org_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'member')
    )
  )
  with check (
    org_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'member')
    )
  );

comment on table resource_bindings is
  'Governed binding layer mapping workflow node config keys to workspace resources. Resolved at execution time by the Lados execution engine.';
