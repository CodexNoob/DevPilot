-- Backfill profiles for auth users created before the on_auth_user_created
-- trigger existed. Without a profile row, inserting a project fails on the
-- projects.owner_id -> profiles.id foreign key. Idempotent.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(left(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), 80), '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
