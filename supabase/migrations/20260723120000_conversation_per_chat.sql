-- One conversations row per entire chat. The chat client now sends a stable
-- session_id with every turn; record_conversation UPSERTs on it so a chat's
-- turns collapse into a single row whose token cost accumulates, instead of one
-- row per message-exchange. This makes the admin "API-Kosten (LLM)" figure a
-- true per-chat cost and keeps the dashboards tracking whole chats, not
-- individual messages. Legacy rows keep a null session_id and stay as they are
-- (Postgres treats nulls as distinct, so the unique index leaves them untouched).

alter table public.conversations
  add column session_id uuid;

create unique index conversations_session_id_key
  on public.conversations (session_id);

-- One 'recommended' event per clinic per chat: a clinic recommended in several
-- turns of the same conversation must count once, not once per turn.
create unique index clinic_events_recommended_unique
  on public.clinic_events (clinic_id, conversation_id)
  where kind = 'recommended';

-- Upsert a whole chat and record its recommendations atomically. Token columns
-- accumulate across turns; transcript/stats take the latest non-null value, so a
-- later redaction failure never wipes an earlier good transcript. Called by the
-- service client only.
create function public.record_conversation(
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
set search_path = public
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

  return v_id;
end;
$$;

revoke all on function public.record_conversation(
  uuid, jsonb, text, text, text, integer, integer, text, integer, integer, uuid[]
) from public, anon, authenticated;

grant execute on function public.record_conversation(
  uuid, jsonb, text, text, text, integer, integer, text, integer, integer, uuid[]
) to service_role;
