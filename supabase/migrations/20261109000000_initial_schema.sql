-- DevPilot initial schema
--
-- Ownership model (Phase 1): every row belongs, directly or through its parent,
-- to exactly one project, and every project belongs to one user. RLS policies
-- resolve access through `private.owns_project()`.
--
-- Child tables carry a denormalised `project_id` guarded by composite foreign
-- keys, e.g. (run_id, project_id) -> test_runs(id, project_id). That keeps RLS
-- checks a single indexed lookup and makes it impossible to attach a row to a
-- parent that lives in a different project.
--
-- Writes that belong to the test worker (updating run status, inserting
-- results) are intentionally NOT granted to `authenticated`. The worker uses
-- the service role server-side, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Schemas & enums
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;

create type public.project_environment as enum ('production', 'staging', 'development');
create type public.test_run_status as enum ('queued', 'running', 'passed', 'failed', 'cancelled', 'error');
create type public.test_run_trigger as enum ('manual', 'scheduled', 'api');
create type public.test_result_status as enum ('passed', 'failed', 'skipped', 'timed_out');
create type public.issue_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create a profile whenever a new auth user signs up.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  base_url text not null check (base_url ~* '^https?://[^\s/$.?#].[^\s]*$' and char_length(base_url) <= 2048),
  environment public.project_environment not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_name_unique unique (owner_id, name)
);

create index projects_owner_id_idx on public.projects (owner_id, created_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

-- Ownership check used by every child-table policy. SECURITY DEFINER so the
-- lookup itself isn't subject to RLS recursion; it only ever answers for the
-- calling user (auth.uid()), so it can't be used to probe other users' data.
create function private.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_project(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.owns_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- test_suites
-- ---------------------------------------------------------------------------

create table public.test_suites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_suites_project_name_unique unique (project_id, name),
  constraint test_suites_id_project_unique unique (id, project_id)
);

create trigger test_suites_set_updated_at
  before update on public.test_suites
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- test_runs
-- ---------------------------------------------------------------------------

create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  suite_id uuid,
  status public.test_run_status not null default 'queued',
  trigger public.test_run_trigger not null default 'manual',
  triggered_by uuid default auth.uid() references public.profiles (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint test_runs_id_project_unique unique (id, project_id),
  -- A suite referenced by a run must belong to the same project. If the
  -- suite is deleted, the run is kept as history and only suite_id is cleared.
  constraint test_runs_suite_fk foreign key (suite_id, project_id)
    references public.test_suites (id, project_id) on delete set null (suite_id),
  constraint test_runs_finished_after_started check (
    finished_at is null or started_at is null or finished_at >= started_at
  )
);

create index test_runs_project_created_idx on public.test_runs (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- test_results
-- ---------------------------------------------------------------------------

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  project_id uuid not null,
  test_name text not null check (char_length(test_name) between 1 and 500),
  status public.test_result_status not null,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_message text,
  logs text,
  -- Object path inside Supabase Storage (bucket added in Phase 2).
  screenshot_path text,
  created_at timestamptz not null default now(),
  constraint test_results_id_project_unique unique (id, project_id),
  constraint test_results_run_fk foreign key (run_id, project_id)
    references public.test_runs (id, project_id) on delete cascade
);

create index test_results_run_idx on public.test_results (run_id);
create index test_results_project_created_idx on public.test_results (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- issues
-- ---------------------------------------------------------------------------

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  test_result_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 10000),
  status public.issue_status not null default 'open',
  severity public.issue_severity not null default 'medium',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_test_result_fk foreign key (test_result_id, project_id)
    references public.test_results (id, project_id) on delete set null (test_result_id)
);

create index issues_project_status_idx on public.issues (project_id, status);

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.test_suites enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_results enable row level security;
alter table public.issues enable row level security;

-- profiles: users see and edit only their own profile. Inserts happen via the
-- signup trigger; deletes cascade from auth.users.
create policy "profiles: select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects: full CRUD for the owner.
create policy "projects: select own" on public.projects
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "projects: insert own" on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "projects: update own" on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "projects: delete own" on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- test_suites: full CRUD within owned projects.
create policy "test_suites: select" on public.test_suites
  for select to authenticated using (private.owns_project(project_id));
create policy "test_suites: insert" on public.test_suites
  for insert to authenticated with check (private.owns_project(project_id));
create policy "test_suites: update" on public.test_suites
  for update to authenticated
  using (private.owns_project(project_id))
  with check (private.owns_project(project_id));
create policy "test_suites: delete" on public.test_suites
  for delete to authenticated using (private.owns_project(project_id));

-- test_runs: owners can read runs and queue new manual runs for themselves.
-- Status transitions are the worker's job (service role).
create policy "test_runs: select" on public.test_runs
  for select to authenticated using (private.owns_project(project_id));
create policy "test_runs: queue" on public.test_runs
  for insert to authenticated with check (
    private.owns_project(project_id)
    and status = 'queued'
    and trigger = 'manual'
    and triggered_by = (select auth.uid())
    and started_at is null
    and finished_at is null
  );

-- test_results: read-only for users; written by the worker.
create policy "test_results: select" on public.test_results
  for select to authenticated using (private.owns_project(project_id));

-- issues: full CRUD within owned projects.
create policy "issues: select" on public.issues
  for select to authenticated using (private.owns_project(project_id));
create policy "issues: insert" on public.issues
  for insert to authenticated with check (
    private.owns_project(project_id) and created_by = (select auth.uid())
  );
create policy "issues: update" on public.issues
  for update to authenticated
  using (private.owns_project(project_id))
  with check (private.owns_project(project_id));
create policy "issues: delete" on public.issues
  for delete to authenticated using (private.owns_project(project_id));

-- Defence in depth: the anonymous role gets no table privileges at all.
revoke all on all tables in schema public from anon;
