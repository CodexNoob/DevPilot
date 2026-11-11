-- Shared sliding-window rate limit for AI test generation.
-- Clients cannot access the bucket table; the authenticated RPC derives its
-- principal from auth.uid() and serializes concurrent requests per user.

create table public.generation_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hits timestamptz[] not null default '{}'::timestamptz[],
  updated_at timestamptz not null default now()
);

alter table public.generation_rate_limits enable row level security;
revoke all on public.generation_rate_limits from anon, authenticated;

create function public.take_generation_rate_limit()
returns table (allowed boolean, retry_after_ms integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_hits timestamptz[];
  v_recent timestamptz[];
  v_count integer;
  v_retry_ms integer;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Insert-or-lock gives each user one serialized decision even when several
  -- app instances receive requests at the same time.
  insert into public.generation_rate_limits as current (user_id, hits, updated_at)
  values (v_user_id, '{}'::timestamptz[], v_now)
  on conflict (user_id) do update
    set updated_at = excluded.updated_at
  returning current.hits into v_hits;

  select coalesce(array_agg(hit order by hit), '{}'::timestamptz[])
    into v_recent
    from unnest(v_hits) as hit
   where hit > v_now - interval '10 minutes';

  v_count := coalesce(array_length(v_recent, 1), 0);
  if v_count >= 10 then
    v_retry_ms := greatest(
      1,
      ceil(extract(epoch from (v_recent[1] + interval '10 minutes' - v_now)) * 1000)::integer
    );
    update public.generation_rate_limits
       set hits = v_recent, updated_at = v_now
     where user_id = v_user_id;
    return query select false, v_retry_ms;
    return;
  end if;

  v_recent := array_append(v_recent, v_now);
  update public.generation_rate_limits
     set hits = v_recent, updated_at = v_now
   where user_id = v_user_id;

  -- Opportunistic cleanup only; it does not participate in the quota result.
  if random() < 0.01 then
    delete from public.generation_rate_limits
     where user_id <> v_user_id
       and updated_at < v_now - interval '1 day';
  end if;

  return query select true, 0;
end;
$$;

revoke all on function public.take_generation_rate_limit() from public, anon;
grant execute on function public.take_generation_rate_limit() to authenticated;
