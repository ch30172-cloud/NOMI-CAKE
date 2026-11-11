-- =====================================================================
-- 0005: fix "infinite recursion detected in policy for relation admin_users".
-- The owner-manage policy queried admin_users from inside an admin_users policy.
-- Use a SECURITY DEFINER helper (like is_admin()) instead.
-- =====================================================================

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.is_active and a.role = 'owner'
  );
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, anon;

drop policy if exists "admin_users: owner manage" on public.admin_users;
drop policy if exists "admin_users: self read" on public.admin_users;

create policy "admin_users: self read" on public.admin_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "admin_users: owner manage" on public.admin_users
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
