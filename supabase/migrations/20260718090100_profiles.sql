-- Profiles: maps auth users to roles. Exactly one login per clinic
-- (unique clinic_id). Rows are written only by the service client
-- (admin invite flow) — no insert/update policies on purpose.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'clinic')),
  clinic_id uuid unique references public.clinics (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (role <> 'clinic' or clinic_id is not null)
);

alter table public.profiles enable row level security;
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;

-- security definer: policies below call these without recursing into RLS.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.app_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select clinic_id from public.profiles where user_id = auth.uid();
$$;

create policy "users read their own profile"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins read all profiles"
  on public.profiles for select
  to authenticated
  using (public.app_role() = 'admin');

-- Clinic-scoped access to the clinics table (needs the helpers above).
create policy "clinic users read their own clinic"
  on public.clinics for select
  to authenticated
  using (id = public.app_clinic_id());

create policy "clinic users update their own clinic"
  on public.clinics for update
  to authenticated
  using (id = public.app_clinic_id())
  with check (id = public.app_clinic_id());

create policy "admins read all clinics"
  on public.clinics for select
  to authenticated
  using (public.app_role() = 'admin');

create policy "admins update all clinics"
  on public.clinics for update
  to authenticated
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');
