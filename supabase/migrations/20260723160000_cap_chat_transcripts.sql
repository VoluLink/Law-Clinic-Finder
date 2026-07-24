-- Cap stored chat transcripts: keep the detailed redacted verlauf only for the
-- newest 200 conversations. Older chats keep their statistics row (tokens, legal
-- area, match count) but lose the stored transcript, which is the heavy jsonb
-- column and the only privacy-sensitive one. Folded into record_conversation so
-- the cap is enforced in real time on every persisted chat; the signature is
-- unchanged, so app code and its tests are untouched. create or replace keeps the
-- existing grants; the revoke/grant block is restated for parity with the
-- original definition (20260723120000_conversation_per_chat).

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

  -- Drop the stored verlauf on every chat except the newest 200 that still have
  -- one. With fewer than 200 transcripts the subquery holds them all and nothing
  -- is nulled. Ordered by created_at (indexed), id as a stable tiebreaker.
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
