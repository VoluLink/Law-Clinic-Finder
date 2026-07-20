-- Clinics: the shared directory table. Provisional columns until the real
-- spreadsheet schema lands (then extended via a later alter-table migration).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  city text,
  address text,
  contact_email text,
  website text,
  legal_areas text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

create index clinics_legal_areas_idx on public.clinics using gin (legal_areas);
create index clinics_is_published_idx on public.clinics (is_published) where is_published;
create index clinics_city_lower_idx on public.clinics (lower(city));

alter table public.clinics enable row level security;

-- Anyone may read published clinics (the chat search relies on this).
create policy "published clinics are readable by everyone"
  on public.clinics for select
  to anon, authenticated
  using (is_published = true);

-- Rows are guarded by RLS; columns by grants. Clinic users may never touch
-- is_published — publishing goes through the service client (admin API).
revoke insert, update, delete on public.clinics from anon;
revoke insert, update, delete on public.clinics from authenticated;
grant update (name, description, city, address, contact_email, website, legal_areas)
  on public.clinics to authenticated;
