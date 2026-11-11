-- Page snapshots for the AI test generator.
--
-- The web app never opens user-supplied URLs itself. It queues a snapshot
-- request for a path on the project's site; the worker opens that exact page in
-- a sandboxed browser (behind its SSRF guard), records what it saw and marks
-- the request done. The generator then writes tests against the real page.

create table public.page_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Root-relative path on the project's base URL; the worker resolves it and
  -- refuses anything that leaves the project's origin.
  path text not null check (path like '/%' and char_length(path) <= 2048),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  snapshot jsonb check (snapshot is null or jsonb_typeof(snapshot) = 'object'),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  requested_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index page_snapshots_queue_idx on public.page_snapshots (created_at) where status = 'queued';
create index page_snapshots_project_idx on public.page_snapshots (project_id);

alter table public.page_snapshots enable row level security;

-- Members of the project's workspace can see snapshots of that project.
create policy "page_snapshots: select" on public.page_snapshots
  for select to authenticated using (private.owns_project(project_id));

-- Users may only request a fresh capture; results are written by the worker.
create policy "page_snapshots: request" on public.page_snapshots
  for insert to authenticated with check (
    private.owns_project(project_id)
    and status = 'queued'
    and snapshot is null
    and error_message is null
    and requested_by = (select auth.uid())
    and started_at is null
    and finished_at is null
  );

-- No update/delete policies: only the worker (service role) changes rows.

-- Atomically claim the oldest queued snapshot. Also expires old rows (they are
-- only needed for the few seconds a generation request waits on them) and
-- fails captures abandoned by a crashed worker.
create function public.claim_next_page_snapshot()
returns setof public.page_snapshots
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.page_snapshots where created_at < now() - interval '1 day';

  update public.page_snapshots
     set status = 'failed', error_message = 'The worker stopped before the capture finished', finished_at = now()
   where status = 'running' and started_at < now() - interval '5 minutes';

  return query
  update public.page_snapshots
     set status = 'running', started_at = now()
   where id = (
     select id from public.page_snapshots
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning *;
end;
$$;

revoke all on function public.claim_next_page_snapshot() from public, anon, authenticated;
grant execute on function public.claim_next_page_snapshot() to service_role;

revoke all on public.page_snapshots from anon;
