-- Self-signup (2026-07-19):
--   clinic_submissions — new-clinic registrations awaiting admin approval
--     (approve inserts into clinics + sends the access invite; reject deletes).
--   claim_requests — log of claim-invite emails per clinic, enforcing the
--     resend limit (max 2 sends per clinic per rolling 7 days).
-- Both tables are touched only by the service client (public signup API and
-- admin routes) — RLS enabled with no policies on purpose.

create table public.clinic_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  website text,
  region text,
  legal_areas text not null default '',
  target_clients text,
  languages text,
  description text,
  requirements text,
  submitted_at timestamptz not null default now()
);

alter table public.clinic_submissions enable row level security;
revoke all on public.clinic_submissions from anon;
revoke all on public.clinic_submissions from authenticated;

create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index claim_requests_clinic_sent_idx on public.claim_requests (clinic_id, sent_at);

alter table public.claim_requests enable row level security;
revoke all on public.claim_requests from anon;
revoke all on public.claim_requests from authenticated;
