-- Data retention: delete regularly-accumulating rows after one year, aligned to
-- month boundaries so the admin dashboard's rolling 12-month statistics window and
-- the stored data agree. The cutoff date_trunc('month', now()) - interval '12
-- months' means that, standing in October 2027, October 2026 is still visible but
-- September 2026 has rolled out (and is deleted). A daily pg_cron job runs the
-- prune independently of chat traffic.
--
-- Scope: conversations (whole stat rows past the window; transcripts are already
-- capped at the newest 200 in record_conversation), clinic_events, and
-- claim_requests. Deliberately excluded: logs (own 7-day prune in the app-side log
-- sink), clinic_submissions (pending self-registrations kept until an admin acts),
-- and all operational tables (clinics, profiles, settings, branding, auth).
-- clinic_events.conversation_id is ON DELETE SET NULL, so removing old
-- conversations leaves no dangling reference.

create extension if not exists pg_cron;

create or replace function public.prune_expired_data() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := date_trunc('month', now()) - interval '12 months';
begin
  delete from public.conversations where created_at < v_cutoff;
  delete from public.clinic_events where created_at < v_cutoff;
  delete from public.claim_requests where sent_at < v_cutoff;
end;
$$;

revoke all on function public.prune_expired_data() from public, anon, authenticated;

-- Re-schedule idempotently so re-running the migration does not stack jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'prune-expired-data') then
    perform cron.unschedule('prune-expired-data');
  end if;
  perform cron.schedule(
    'prune-expired-data',
    '20 3 * * *',
    'select public.prune_expired_data();'
  );
end;
$$;
