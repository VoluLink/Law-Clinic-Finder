-- A pending clinic invite already has a profile row, so profile existence alone
-- cannot distinguish an accepted account from one that still needs a fresh link.
alter table public.profiles add column activated_at timestamptz;

-- Preserve the state of accounts that accepted an invitation before this
-- migration. Unconfirmed invitations remain null and may receive a resend.
update public.profiles as profile
set activated_at = coalesce(auth_user.last_sign_in_at, auth_user.email_confirmed_at)
from auth.users as auth_user
where profile.user_id = auth_user.id
  and auth_user.email_confirmed_at is not null;
