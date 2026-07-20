-- Conversations: chat transcripts stored ONLY after PII redaction, plus
-- structured fields for admin stats. Inserted by the service client after
-- the response stream closes. If redaction fails, redacted_transcript stays
-- null (stats-only row) — the privacy-safe default.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  redacted_transcript jsonb,
  redaction_status text not null check (redaction_status in ('ok', 'failed')),
  detected_legal_area text,
  detected_city text,
  matched_clinic_count integer,
  message_count integer not null,
  model text not null,
  check (redaction_status = 'ok' or redacted_transcript is null)
);

create index conversations_created_at_idx on public.conversations (created_at);
create index conversations_legal_area_idx on public.conversations (detected_legal_area);

alter table public.conversations enable row level security;
revoke insert, update, delete on public.conversations from anon;
revoke insert, update on public.conversations from authenticated;

create policy "admins read conversations"
  on public.conversations for select
  to authenticated
  using (public.app_role() = 'admin');

-- GDPR erasure: admins may delete conversations.
create policy "admins delete conversations"
  on public.conversations for delete
  to authenticated
  using (public.app_role() = 'admin');
