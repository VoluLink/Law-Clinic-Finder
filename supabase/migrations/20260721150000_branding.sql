-- Branding: single-row theme for the public pages (Finder/Chat/Portal). Colors,
-- wordmark, logo and font are public information (they render on public pages),
-- so anyone may read; only the service client (admin flow) writes.

create table public.branding (
  id boolean primary key default true,
  wordmark text not null default 'law clinics',
  logo_url text,
  color_primary text not null default '#0d4b5b',
  color_background text not null default '#faf2e7',
  color_accent text not null default '#f0e6d2',
  color_foreground text not null default '#3a565e',
  font text not null default 'Hanken Grotesk',
  updated_at timestamptz not null default now(),
  constraint branding_singleton check (id = true)
);

insert into public.branding (id) values (true) on conflict (id) do nothing;

alter table public.branding enable row level security;
create policy "anyone reads branding"
  on public.branding for select
  to anon, authenticated
  using (true);

-- Public bucket for uploaded logos; writes go through the service-role client.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;
