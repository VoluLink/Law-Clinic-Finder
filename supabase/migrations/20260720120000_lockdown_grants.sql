-- Lockdown pass (2026-07-20).
--
-- 1. Drop anon SELECT grants that no policy backs. RLS already returns nothing
--    for anon on these tables, so this removes dead surface rather than
--    behaviour — but it means a future permissive policy cannot silently turn
--    into a public read.
-- 2. Take contact_email away from anon. The RLS policy on clinics filters rows
--    (is_published), never columns, so anon could read all 59 addresses via
--    PostgREST with the anon key that ships in the browser bundle. The chat
--    still hands addresses out; its lookup moved to the service-role client.
-- 3. Move the SECURITY DEFINER role helpers out of the PostgREST-exposed
--    schema (advisor lint 0029). Revoking EXECUTE from `authenticated` is not
--    an option: RLS policy expressions run as the invoking role, so that would
--    make every policy below error and lock all users out.

-- 1 --------------------------------------------------------------------------
revoke select on public.profiles from anon;
revoke select on public.conversations from anon;
revoke select on public.settings from anon;

-- 2 --------------------------------------------------------------------------
-- INEFFECTIVE as written: anon held a TABLE-level SELECT on clinics, which
-- covers every column, so a column-level revoke changes nothing. Superseded by
-- 20260720120100_lockdown_clinics_contact_email.sql, which drops the table
-- grant and re-grants column by column. Left in place so the migration history
-- matches what was actually applied.
revoke select (contact_email) on public.clinics from anon;

-- 3 --------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function private.app_clinic_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select clinic_id from public.profiles where user_id = auth.uid();
$$;

revoke execute on function private.app_role() from public, anon;
revoke execute on function private.app_clinic_id() from public, anon;
grant execute on function private.app_role() to authenticated;
grant execute on function private.app_clinic_id() to authenticated;

-- Repoint every policy that referenced the public.* helpers. The anon
-- "published clinics" policy and the "users read their own profile" policy use
-- neither helper and are deliberately left untouched.

drop policy "admins read all clinics" on public.clinics;
create policy "admins read all clinics" on public.clinics
  for select to authenticated using (private.app_role() = 'admin');

drop policy "admins update all clinics" on public.clinics;
create policy "admins update all clinics" on public.clinics
  for update to authenticated
  using (private.app_role() = 'admin') with check (private.app_role() = 'admin');

drop policy "clinic users read their own clinic" on public.clinics;
create policy "clinic users read their own clinic" on public.clinics
  for select to authenticated using (id = private.app_clinic_id());

drop policy "clinic users update their own clinic" on public.clinics;
create policy "clinic users update their own clinic" on public.clinics
  for update to authenticated
  using (id = private.app_clinic_id()) with check (id = private.app_clinic_id());

drop policy "admins read conversations" on public.conversations;
create policy "admins read conversations" on public.conversations
  for select to authenticated using (private.app_role() = 'admin');

drop policy "admins delete conversations" on public.conversations;
create policy "admins delete conversations" on public.conversations
  for delete to authenticated using (private.app_role() = 'admin');

drop policy "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (private.app_role() = 'admin');

drop policy "admins read settings" on public.settings;
create policy "admins read settings" on public.settings
  for select to authenticated using (private.app_role() = 'admin');

drop policy "admins insert settings" on public.settings;
create policy "admins insert settings" on public.settings
  for insert to authenticated with check (private.app_role() = 'admin');

drop policy "admins update settings" on public.settings;
create policy "admins update settings" on public.settings
  for update to authenticated
  using (private.app_role() = 'admin') with check (private.app_role() = 'admin');

drop policy "admins delete settings" on public.settings;
create policy "admins delete settings" on public.settings
  for delete to authenticated using (private.app_role() = 'admin');

drop function public.app_role();
drop function public.app_clinic_id();
