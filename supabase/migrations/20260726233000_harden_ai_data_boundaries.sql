-- Lock down the database boundary around the AI-assisted directory.
--
-- contact_email is intentionally delivered only in a selected recommendation
-- card. It must not be readable through PostgREST by either anonymous visitors
-- or signed-in clinic accounts, because that enables bulk harvesting. Authorized
-- member/admin server renders use the service client only after a role check.

revoke all on public.clinics from anon, authenticated;

grant select (
  id, name, description, region, website, legal_areas,
  target_clients, languages, requirements, advises_clients,
  is_published, created_at, updated_at
) on public.clinics to anon, authenticated;

grant update (
  name, description, region, contact_email, website, legal_areas,
  target_clients, languages, requirements, advises_clients
) on public.clinics to authenticated;

-- Reset every existing application relation to its documented minimum access.
-- RLS still decides which rows an authenticated caller can access.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

revoke all on public.settings from anon, authenticated;
grant select, insert, update, delete on public.settings to authenticated;

revoke all on public.conversations from anon, authenticated;
grant select, delete on public.conversations to authenticated;

revoke all on public.logs from anon, authenticated;
grant select, delete on public.logs to authenticated;

revoke all on public.clinic_events from anon, authenticated;
grant select on public.clinic_events to authenticated;

revoke all on public.clinic_event_counts from anon, authenticated;
grant select on public.clinic_event_counts to authenticated;

revoke all on public.branding from anon, authenticated;
grant select on public.branding to anon, authenticated;

revoke all on public.clinic_submissions from anon, authenticated;
revoke all on public.claim_requests from anon, authenticated;

-- Future migrations must grant every public capability explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke create on schema public from public, anon, authenticated;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Privileged functions must never resolve attacker-controlled objects from the
-- public schema. All application relations below are schema-qualified.
create or replace function public.record_conversation(
  p_session_id uuid,
  p_redacted_transcript jsonb,
  p_redaction_status text,
  p_detected_legal_area text,
  p_detected_city text,
  p_matched_clinic_count integer,
  p_message_count integer,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_recommended_clinic_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.conversations as c (
    session_id, redacted_transcript, redaction_status, detected_legal_area,
    detected_city, matched_clinic_count, message_count, model,
    input_tokens, output_tokens
  ) values (
    p_session_id, p_redacted_transcript, p_redaction_status, p_detected_legal_area,
    p_detected_city, p_matched_clinic_count, p_message_count, p_model,
    p_input_tokens, p_output_tokens
  )
  on conflict (session_id) do update set
    input_tokens = c.input_tokens + excluded.input_tokens,
    output_tokens = c.output_tokens + excluded.output_tokens,
    message_count = excluded.message_count,
    model = excluded.model,
    matched_clinic_count = coalesce(excluded.matched_clinic_count, c.matched_clinic_count),
    detected_legal_area = coalesce(excluded.detected_legal_area, c.detected_legal_area),
    detected_city = coalesce(excluded.detected_city, c.detected_city),
    redacted_transcript = coalesce(excluded.redacted_transcript, c.redacted_transcript),
    redaction_status = case
      when coalesce(excluded.redacted_transcript, c.redacted_transcript) is null then 'failed'
      else 'ok'
    end
  returning c.id into v_id;

  if array_length(p_recommended_clinic_ids, 1) is not null then
    insert into public.clinic_events (clinic_id, kind, conversation_id)
    select rec.clinic_id, 'recommended', v_id
    from unnest(p_recommended_clinic_ids) as rec(clinic_id)
    on conflict (clinic_id, conversation_id) where kind = 'recommended' do nothing;
  end if;

  update public.conversations
  set redacted_transcript = null
  where redacted_transcript is not null
    and id not in (
      select id from public.conversations
      where redacted_transcript is not null
      order by created_at desc, id desc
      limit 200
    );

  return v_id;
end;
$$;

revoke all on function public.record_conversation(
  uuid, jsonb, text, text, text, integer, integer, text, integer, integer, uuid[]
) from public, anon, authenticated;

grant execute on function public.record_conversation(
  uuid, jsonb, text, text, text, integer, integer, text, integer, integer, uuid[]
) to service_role;

create or replace function public.prune_expired_data() returns void
language plpgsql
security definer
set search_path = ''
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
revoke execute on function public.set_updated_at() from public, anon, authenticated;
