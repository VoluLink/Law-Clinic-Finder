-- Self-service clinic access + admin account management.
--
-- Two separate things can await approval, so there are two columns:
--   clinics.approval_status  — is this entry part of the directory at all?
--   profiles.access_status   — may this person act for their clinic yet?
-- Claiming an entry that has no address on file leaves the clinic approved (an
-- admin created it) while the claimant's ownership is not, so a single column
-- cannot express both states.
--
-- Both default to the closed value: a code path that forgets to set a status
-- fails shut rather than granting access. Admin-created rows set the open value
-- explicitly.

alter table public.clinics
  add column approval_status text not null default 'pending'
  check (approval_status in ('pending', 'approved'));

alter table public.profiles
  add column access_status text not null default 'pending'
  check (access_status in ('pending', 'active'));

-- Existing rows predate self-registration: every clinic was entered by an admin,
-- and both existing logins are real. Runs before the invariant below, which the
-- 47 published rows would otherwise violate while still defaulted to 'pending'.
update public.clinics set approval_status = 'approved';
update public.profiles set access_status = 'active';

-- A clinic awaiting approval can never be public. This is what keeps a
-- self-registered entry out of the chat and the directory without every read
-- path having to remember a second filter.
alter table public.clinics
  add constraint clinics_pending_not_published
  check (approval_status = 'approved' or is_published = false);

-- Pending access is revoked in the database, not only in the UI. Every clinic
-- policy resolves ownership through this helper, so filtering it on the active
-- status makes a pending session unable to read or update its clinic — and
-- closes clinic_events statistics for the same session for free.
create or replace function private.app_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select clinic_id
    from public.profiles
   where user_id = auth.uid()
     and access_status = 'active';
$$;

revoke execute on function private.app_clinic_id() from public, anon;
grant execute on function private.app_clinic_id() to authenticated;

-- Deleting a clinic deletes its login. profiles.clinic_id already cascades, but
-- that leaves the auth.users row behind: an account with no profile, no role and
-- no way in, kept alive forever. Enforced by trigger so a dashboard or SQL
-- delete behaves exactly like the admin route.
create or replace function private.delete_clinic_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users u
   using public.profiles p
   where p.clinic_id = old.id
     and p.user_id = u.id;
  return old;
end;
$$;

revoke execute on function private.delete_clinic_login() from public, anon, authenticated;

-- No recursion: removing the auth user cascades to profiles, and removing a
-- profile does not touch clinics.
create trigger clinics_delete_login
  before delete on public.clinics
  for each row execute function private.delete_clinic_login();

-- Registration now creates a pending clinics row directly, so the login can be
-- linked to it (profiles.clinic_id is a foreign key). The staging table held no
-- rows at the time of this migration.
drop table if exists public.clinic_submissions;
