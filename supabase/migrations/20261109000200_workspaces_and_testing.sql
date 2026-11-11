-- Workspaces (teams), clients, test cases, schedules and richer test runs.
--
-- Ownership model (Phase 2): every project belongs to a workspace, and access
-- is granted through workspace membership. `private.owns_project()` keeps its
-- name (every child-table policy calls it) but now answers "is the caller a
-- member of the project's workspace?".
--
-- Roles:
--   owner  - everything, including deleting the workspace and managing owners
--   admin  - manage members, invitations, clients; delete projects
--   member - create and edit projects, suites, test cases, schedules; queue runs
--
-- The test worker uses the service role. Its entry points
-- (`claim_next_run`, `claim_due_schedules`) are not callable by users.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.test_case_source as enum ('manual', 'ai');

-- ---------------------------------------------------------------------------
-- profiles: store the email so teammates can see who is who
-- ---------------------------------------------------------------------------

alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function private.sync_profile_email();

-- ---------------------------------------------------------------------------
-- workspaces & membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (
    email = lower(trim(email)) and char_length(email) between 3 and 320 and position('@' in email) > 1
  ),
  -- Ownership is transferred, never handed out by invitation.
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint workspace_invitations_workspace_email_unique unique (workspace_id, email)
);

create index workspace_invitations_email_idx on public.workspace_invitations (email);

-- Membership helpers. SECURITY DEFINER so policies on workspace_members can
-- call them without recursing into their own RLS; they only ever answer for
-- the calling user.
create function private.workspace_role(p_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = (select auth.uid());
$$;

create function private.is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) is not null;
$$;

create function private.is_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.workspace_role(p_workspace_id) in ('owner', 'admin'), false);
$$;

create function private.shares_workspace(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.workspace_role(uuid) from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_admin(uuid) from public;
revoke all on function private.shares_workspace(uuid) from public;
grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;

-- The creator of a workspace becomes its owner.
create function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function private.handle_new_workspace();

-- A workspace must always keep at least one owner (unless it is being deleted).
create function private.ensure_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip when the workspace itself, or the member's account, is being deleted.
  if exists (select 1 from public.workspaces w where w.id = old.workspace_id)
     and exists (select 1 from public.profiles p where p.id = old.user_id)
     and not exists (
       select 1 from public.workspace_members m
       where m.workspace_id = old.workspace_id and m.role = 'owner'
     ) then
    raise exception 'A workspace must have at least one owner'
      using errcode = 'P0001', hint = 'workspace_requires_owner';
  end if;
  return null;
end;
$$;

create trigger workspace_members_keep_owner
  after update or delete on public.workspace_members
  for each row execute function private.ensure_workspace_owner();

-- Signup: profile + personal workspace (owner membership via the trigger above).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '');
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, v_name, new.email);

  insert into public.workspaces (name, created_by)
  values (coalesce(v_name || '''s workspace', 'My workspace'), new.id);

  return new;
end;
$$;

-- Backfill: a personal workspace for every existing profile.
insert into public.workspaces (name, created_by)
select coalesce(p.display_name || '''s workspace', 'My workspace'), p.id
from public.profiles p;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  contact_email text check (
    contact_email is null or (char_length(contact_email) <= 320 and position('@' in contact_email) > 1)
  ),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_workspace_name_unique unique (workspace_id, name),
  constraint clients_id_workspace_unique unique (id, workspace_id)
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects: move from single owner to workspace
-- ---------------------------------------------------------------------------

drop policy "projects: select own" on public.projects;
drop policy "projects: insert own" on public.projects;
drop policy "projects: update own" on public.projects;
drop policy "projects: delete own" on public.projects;

alter table public.projects add column workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.projects add column client_id uuid;

update public.projects p
set workspace_id = w.id
from public.workspaces w
where w.created_by = p.owner_id;

alter table public.projects alter column workspace_id set not null;

-- owner_id becomes an informational "created_by": deleting a user must not
-- delete projects their teammates still use.
alter table public.projects rename column owner_id to created_by;
alter table public.projects drop constraint projects_owner_id_fkey;
alter table public.projects alter column created_by drop not null;
alter table public.projects
  add constraint projects_created_by_fkey foreign key (created_by)
  references public.profiles (id) on delete set null;

alter table public.projects drop constraint projects_owner_name_unique;
alter table public.projects add constraint projects_workspace_name_unique unique (workspace_id, name);
alter table public.projects
  add constraint projects_client_fk foreign key (client_id, workspace_id)
  references public.clients (id, workspace_id) on delete set null (client_id);

drop index public.projects_owner_id_idx;
create index projects_workspace_idx on public.projects (workspace_id, created_at desc);
create index projects_client_idx on public.projects (client_id) where client_id is not null;

create or replace function private.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.workspace_members m on m.workspace_id = p.workspace_id
    where p.id = p_project_id
      and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- test_cases: executable steps, validated by the app and the worker
-- ---------------------------------------------------------------------------

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  suite_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 100),
  source public.test_case_source not null default 'manual',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_cases_suite_fk foreign key (suite_id, project_id)
    references public.test_suites (id, project_id) on delete cascade,
  constraint test_cases_suite_name_unique unique (suite_id, name),
  constraint test_cases_id_project_unique unique (id, project_id)
);

create index test_cases_project_idx on public.test_cases (project_id);

create trigger test_cases_set_updated_at
  before update on public.test_cases
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- schedules: cron-triggered runs, enqueued by the worker
-- ---------------------------------------------------------------------------

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  suite_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  cron text not null check (char_length(cron) between 9 and 100),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  branch text not null default 'main' check (branch ~ '^[A-Za-z0-9._/-]{1,100}$'),
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_suite_fk foreign key (suite_id, project_id)
    references public.test_suites (id, project_id) on delete cascade,
  constraint schedules_id_project_unique unique (id, project_id)
);

create index schedules_due_idx on public.schedules (next_run_at) where enabled;
create index schedules_project_idx on public.schedules (project_id);

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- test_runs: number, branch, counts, duration, schedule link
-- ---------------------------------------------------------------------------

alter table public.test_runs
  add column number integer,
  add column branch text not null default 'main' check (branch ~ '^[A-Za-z0-9._/-]{1,100}$'),
  add column schedule_id uuid,
  add column passed_count integer not null default 0 check (passed_count >= 0),
  add column failed_count integer not null default 0 check (failed_count >= 0),
  add column skipped_count integer not null default 0 check (skipped_count >= 0),
  add column total_count integer not null default 0 check (total_count >= 0),
  add column error_message text check (error_message is null or char_length(error_message) <= 5000),
  add column duration_ms integer generated always as (
    (extract(epoch from (finished_at - started_at)) * 1000)::integer
  ) stored;

alter table public.test_runs
  add constraint test_runs_schedule_fk foreign key (schedule_id, project_id)
  references public.schedules (id, project_id) on delete set null (schedule_id);

-- Per-project run numbers (#1, #2, ...). Counters live in the private schema
-- so bumping them doesn't touch projects.updated_at.
create table private.project_run_counters (
  project_id uuid primary key references public.projects (id) on delete cascade,
  value integer not null
);

insert into private.project_run_counters (project_id, value)
select project_id, count(*) from public.test_runs group by project_id;

with numbered as (
  select id, row_number() over (partition by project_id order by created_at, id) as n
  from public.test_runs
)
update public.test_runs r set number = numbered.n from numbered where numbered.id = r.id;

alter table public.test_runs alter column number set not null;
alter table public.test_runs add constraint test_runs_project_number_unique unique (project_id, number);

create function private.assign_run_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.project_run_counters (project_id, value)
  values (new.project_id, 1)
  on conflict (project_id) do update set value = private.project_run_counters.value + 1
  returning value into new.number;
  return new;
end;
$$;

create trigger test_runs_assign_number
  before insert on public.test_runs
  for each row execute function private.assign_run_number();

create index test_runs_status_idx on public.test_runs (status, created_at) where status in ('queued', 'running');

-- Users may only queue a fresh manual run: no fabricated counts or results.
drop policy "test_runs: queue" on public.test_runs;
create policy "test_runs: queue" on public.test_runs
  for insert to authenticated with check (
    private.owns_project(project_id)
    and status = 'queued'
    and trigger = 'manual'
    and triggered_by = (select auth.uid())
    and started_at is null
    and finished_at is null
    and schedule_id is null
    and passed_count = 0
    and failed_count = 0
    and skipped_count = 0
    and total_count = 0
    and error_message is null
  );

-- Users can cancel a run that hasn't started. Everything else is the worker's.
create function public.cancel_run(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.test_runs where id = p_run_id;
  if v_project is null or not private.owns_project(v_project) then
    return false;
  end if;
  update public.test_runs
  set status = 'cancelled', finished_at = now()
  where id = p_run_id and status = 'queued';
  return found;
end;
$$;

revoke all on function public.cancel_run(uuid) from public, anon;
grant execute on function public.cancel_run(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- test_results: link to the test case that produced them
-- ---------------------------------------------------------------------------

-- Direct FK to projects so the API can embed project names (also for the
-- flaky_tests view, whose relationships are inferred from this table).
alter table public.test_results
  add constraint test_results_project_id_fkey foreign key (project_id)
  references public.projects (id) on delete cascade;

alter table public.test_results add column test_case_id uuid;
alter table public.test_results
  add constraint test_results_test_case_fk foreign key (test_case_id, project_id)
  references public.test_cases (id, project_id) on delete set null (test_case_id);

create index test_results_case_created_idx on public.test_results (project_id, test_name, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security for new tables
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.clients enable row level security;
alter table public.test_cases enable row level security;
alter table public.schedules enable row level security;

-- profiles: also visible to teammates (names and emails on the Users page).
create policy "profiles: select teammates" on public.profiles
  for select to authenticated using (private.shares_workspace(id));

-- workspaces
create policy "workspaces: select member" on public.workspaces
  for select to authenticated using (private.is_member(id));
create policy "workspaces: update admin" on public.workspaces
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));
create policy "workspaces: delete owner" on public.workspaces
  for delete to authenticated using (private.workspace_role(id) = 'owner');

-- workspace_members: members are added only by accepting an invitation (or by
-- creating a workspace). Admins manage roles but only owners touch owners.
create policy "workspace_members: select" on public.workspace_members
  for select to authenticated using (private.is_member(workspace_id));
create policy "workspace_members: update" on public.workspace_members
  for update to authenticated
  using (
    private.is_admin(workspace_id)
    and (role <> 'owner' or private.workspace_role(workspace_id) = 'owner')
  )
  with check (
    private.is_admin(workspace_id)
    and (role <> 'owner' or private.workspace_role(workspace_id) = 'owner')
  );
create policy "workspace_members: delete" on public.workspace_members
  for delete to authenticated using (
    user_id = (select auth.uid())
    or (
      private.is_admin(workspace_id)
      and (role <> 'owner' or private.workspace_role(workspace_id) = 'owner')
    )
  );

-- workspace_invitations: admins manage; invitees can see and decline theirs.
create policy "workspace_invitations: select" on public.workspace_invitations
  for select to authenticated using (
    private.is_admin(workspace_id)
    or email = lower((select auth.jwt()) ->> 'email')
  );
create policy "workspace_invitations: insert admin" on public.workspace_invitations
  for insert to authenticated with check (
    private.is_admin(workspace_id) and invited_by = (select auth.uid())
  );
create policy "workspace_invitations: delete" on public.workspace_invitations
  for delete to authenticated using (
    private.is_admin(workspace_id)
    or email = lower((select auth.jwt()) ->> 'email')
  );

-- Workspaces are created through this function rather than a direct insert:
-- the owner membership is added by an AFTER trigger, so the new row would not
-- yet be visible to the creator for INSERT ... RETURNING.
create function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.workspaces (name, created_by)
  values (trim(p_name), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- Accepting an invitation is the only way to join someone else's workspace.
create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.workspace_invitations;
  v_email text := lower((select auth.jwt()) ->> 'email');
begin
  if (select auth.uid()) is null or v_email is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where id = p_invitation_id and email = v_email;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invitation.workspace_id, (select auth.uid()), v_invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  delete from public.workspace_invitations where id = v_invitation.id;
  return v_invitation.workspace_id;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- The caller's own pending invitations, with the workspace name (invitees
-- aren't members yet, so RLS on workspaces would hide it).
create function public.my_invitations()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  role public.workspace_role,
  invited_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.workspace_id, w.name, i.role, coalesce(p.display_name, p.email), i.created_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = lower((select auth.jwt()) ->> 'email')
  order by i.created_at desc;
$$;

revoke all on function public.my_invitations() from public, anon;
grant execute on function public.my_invitations() to authenticated;

-- clients: visible to members, managed by admins.
create policy "clients: select" on public.clients
  for select to authenticated using (private.is_member(workspace_id));
create policy "clients: insert admin" on public.clients
  for insert to authenticated with check (private.is_admin(workspace_id));
create policy "clients: update admin" on public.clients
  for update to authenticated
  using (private.is_admin(workspace_id))
  with check (private.is_admin(workspace_id));
create policy "clients: delete admin" on public.clients
  for delete to authenticated using (private.is_admin(workspace_id));

-- projects: members collaborate; admins delete.
create policy "projects: select member" on public.projects
  for select to authenticated using (private.is_member(workspace_id));
create policy "projects: insert member" on public.projects
  for insert to authenticated with check (
    private.is_member(workspace_id) and created_by = (select auth.uid())
  );
create policy "projects: update member" on public.projects
  for update to authenticated
  using (private.is_member(workspace_id))
  with check (private.is_member(workspace_id));
create policy "projects: delete admin" on public.projects
  for delete to authenticated using (private.is_admin(workspace_id));

-- test_cases & schedules: full CRUD within accessible projects.
create policy "test_cases: select" on public.test_cases
  for select to authenticated using (private.owns_project(project_id));
create policy "test_cases: insert" on public.test_cases
  for insert to authenticated with check (private.owns_project(project_id));
create policy "test_cases: update" on public.test_cases
  for update to authenticated
  using (private.owns_project(project_id))
  with check (private.owns_project(project_id));
create policy "test_cases: delete" on public.test_cases
  for delete to authenticated using (private.owns_project(project_id));

create policy "schedules: select" on public.schedules
  for select to authenticated using (private.owns_project(project_id));
create policy "schedules: insert" on public.schedules
  for insert to authenticated with check (private.owns_project(project_id));
create policy "schedules: update" on public.schedules
  for update to authenticated
  using (private.owns_project(project_id))
  with check (private.owns_project(project_id));
create policy "schedules: delete" on public.schedules
  for delete to authenticated using (private.owns_project(project_id));

-- ---------------------------------------------------------------------------
-- Analytics: flaky tests view and daily run stats
-- ---------------------------------------------------------------------------

-- A test is flaky when, over the last 30 days, it has both passed and failed.
-- security_invoker makes the view respect the caller's RLS.
create view public.flaky_tests
with (security_invoker = true)
as
select
  r.project_id,
  r.test_name,
  count(*)::integer as total_runs,
  (count(*) filter (where r.status = 'passed'))::integer as passed_runs,
  (count(*) filter (where r.status in ('failed', 'timed_out')))::integer as failed_runs,
  round(100.0 * count(*) filter (where r.status in ('failed', 'timed_out')) / count(*), 1) as failure_rate,
  max(r.created_at) as last_run_at,
  max(r.created_at) filter (where r.status in ('failed', 'timed_out')) as last_failed_at
from public.test_results r
where r.created_at > now() - interval '30 days'
group by r.project_id, r.test_name
having count(*) filter (where r.status = 'passed') > 0
   and count(*) filter (where r.status in ('failed', 'timed_out')) > 0;

-- Per-day run counts for a workspace (UTC days, oldest first). Runs with the
-- caller's privileges, so RLS still applies.
create function public.run_daily_stats(p_workspace_id uuid, p_days integer default 30)
returns table (
  day date,
  passed integer,
  failed integer,
  total integer,
  avg_duration_ms integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(
      ((now() at time zone 'utc')::date - (least(greatest(p_days, 1), 90) - 1))::timestamp,
      (now() at time zone 'utc')::date::timestamp,
      interval '1 day'
    )::date as day
  ),
  runs as (
    select (r.created_at at time zone 'utc')::date as day, r.status, r.duration_ms
    from public.test_runs r
    join public.projects p on p.id = r.project_id
    where p.workspace_id = p_workspace_id
      and r.created_at >= (((now() at time zone 'utc')::date - (least(greatest(p_days, 1), 90) - 1))::timestamp at time zone 'utc')
  )
  select
    d.day,
    (count(r.day) filter (where r.status = 'passed'))::integer,
    (count(r.day) filter (where r.status = 'failed'))::integer,
    count(r.day)::integer,
    avg(r.duration_ms) filter (where r.status in ('passed', 'failed'))::integer
  from days d
  left join runs r on r.day = d.day
  group by d.day
  order by d.day;
$$;

revoke all on function public.run_daily_stats(uuid, integer) from public, anon;
grant execute on function public.run_daily_stats(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Worker entry points (service role only)
-- ---------------------------------------------------------------------------

-- Atomically claim the oldest queued run. SKIP LOCKED lets several workers
-- poll the same queue without double-processing.
create function public.claim_next_run()
returns setof public.test_runs
language sql
volatile
security definer
set search_path = ''
as $$
  update public.test_runs
  set status = 'running', started_at = now()
  where id = (
    select id from public.test_runs
    where status = 'queued'
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
$$;

-- Claim schedules that are due. next_run_at is cleared so no other worker
-- picks them up; the claiming worker computes and writes the next time.
create function public.claim_due_schedules()
returns setof public.schedules
language sql
volatile
security definer
set search_path = ''
as $$
  update public.schedules
  set next_run_at = null, last_run_at = now()
  where id in (
    select id from public.schedules
    where enabled and next_run_at <= now()
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_next_run() from public, anon, authenticated;
revoke all on function public.claim_due_schedules() from public, anon, authenticated;
grant execute on function public.claim_next_run() to service_role;
grant execute on function public.claim_due_schedules() to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for failure screenshots (Supabase only)
-- Object paths are "<project_id>/<run_id>/<result_id>.png".
-- ---------------------------------------------------------------------------

create function private.owns_project_path(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  begin
    v_project := split_part(p_path, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.owns_project(v_project);
end;
$$;

revoke all on function private.owns_project_path(text) from public;
grant execute on function private.owns_project_path(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('screenshots', 'screenshots', false)
    on conflict (id) do nothing;

    begin
      execute $policy$
        create policy "screenshots: read in accessible projects" on storage.objects
          for select to authenticated
          using (bucket_id = 'screenshots' and private.owns_project_path(name))
      $policy$;
    exception when insufficient_privilege then
      raise notice 'Skipped storage policy: create it in Dashboard > Storage > Policies';
    end;
  end if;
end;
$$;

-- Defence in depth: the anonymous role gets no table privileges at all.
revoke all on all tables in schema public from anon;
