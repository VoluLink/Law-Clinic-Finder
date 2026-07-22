-- Per-clinic engagement events for the member statistics tab: how often a
-- clinic was recommended by the assistant, and how often users clicked its
-- website link or email. No user PII is stored — only the clinic, the kind of
-- event, and a timestamp. 'recommended' rows are written by the service client
-- when a conversation is persisted; click rows by the public /api/clinic-events
-- beacon. Members read only their own clinic's events (RLS); the admin UI does
-- not surface these (member-only, by product decision).

create table public.clinic_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  kind text not null check (kind in ('recommended', 'click_website', 'click_email')),
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index clinic_events_clinic_kind_idx on public.clinic_events (clinic_id, kind);
create index clinic_events_created_at_idx on public.clinic_events (created_at);

alter table public.clinic_events enable row level security;

-- Writes are service-role only (recommend persistence + click beacon validate
-- and insert server-side). Anon cannot even read.
revoke insert, update, delete on public.clinic_events from anon, authenticated;
revoke select on public.clinic_events from anon;

create policy "clinic users read their own events"
  on public.clinic_events for select
  to authenticated
  using (clinic_id = private.app_clinic_id());

-- Aggregated counts for the member stats cards. security_invoker keeps the
-- caller's RLS in force, so a member only ever sees their own clinic's row.
create view public.clinic_event_counts
  with (security_invoker = on) as
  select
    clinic_id,
    count(*) filter (where kind = 'recommended')   as recommended_count,
    count(*) filter (where kind = 'click_website') as website_click_count,
    count(*) filter (where kind = 'click_email')   as email_click_count
  from public.clinic_events
  group by clinic_id;

revoke all on public.clinic_event_counts from anon;
grant select on public.clinic_event_counts to authenticated;
