-- Exact chat quota with minimal storage: one short-lived row per anonymous
-- browser profile and Berlin calendar day. The raw first-party cookie is never
-- persisted; only its SHA-256 digest reaches this private table.

begin;

create table private.chat_daily_quotas (
  quota_date date not null,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  session_ids uuid[] not null default '{}'::uuid[],
  turn_counts smallint[] not null default '{}'::smallint[],
  primary key (quota_date, device_hash),
  constraint chat_daily_quotas_two_sessions check (cardinality(session_ids) <= 2),
  constraint chat_daily_quotas_matching_counts check (
    cardinality(session_ids) = cardinality(turn_counts)
  )
);

alter table private.chat_daily_quotas enable row level security;
revoke all on private.chat_daily_quotas from public, anon, authenticated;

create or replace function public.claim_chat_daily_quota(
  p_device_hash text,
  p_session_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_reset_at timestamptz := ((v_today + 1)::timestamp at time zone 'Europe/Berlin');
  v_session_ids uuid[];
  v_turn_counts smallint[];
  v_session_index integer;
begin
  if p_device_hash !~ '^[0-9a-f]{64}$' or p_session_id is null then
    raise exception 'invalid chat quota claim' using errcode = '22023';
  end if;

  insert into private.chat_daily_quotas (quota_date, device_hash)
  values (v_today, p_device_hash)
  on conflict (quota_date, device_hash) do nothing;

  select session_ids, turn_counts
  into v_session_ids, v_turn_counts
  from private.chat_daily_quotas
  where quota_date = v_today and device_hash = p_device_hash
  for update;

  v_session_index := array_position(v_session_ids, p_session_id);
  if v_session_index is null then
    if cardinality(v_session_ids) >= 2 then
      return jsonb_build_object('allowed', false, 'scope', 'day', 'resetAt', v_reset_at);
    end if;
    v_session_ids := array_append(v_session_ids, p_session_id);
    v_turn_counts := array_append(v_turn_counts, 1::smallint);
  else
    if v_turn_counts[v_session_index] >= 8 then
      return jsonb_build_object('allowed', false, 'scope', 'day', 'resetAt', v_reset_at);
    end if;
    v_turn_counts[v_session_index] := v_turn_counts[v_session_index] + 1;
  end if;

  update private.chat_daily_quotas
  set session_ids = v_session_ids, turn_counts = v_turn_counts
  where quota_date = v_today and device_hash = p_device_hash;

  return jsonb_build_object('allowed', true, 'scope', null, 'resetAt', v_reset_at);
end;
$$;

revoke all on function public.claim_chat_daily_quota(text, uuid)
from public, anon, authenticated;
grant execute on function public.claim_chat_daily_quota(text, uuid) to service_role;

create or replace function public.prune_expired_data() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := date_trunc('month', now()) - interval '12 months';
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  delete from public.conversations where created_at < v_cutoff;
  delete from public.clinic_events where created_at < v_cutoff;
  delete from public.claim_requests where sent_at < v_cutoff;
  delete from private.chat_daily_quotas where quota_date < v_today;
end;
$$;

revoke all on function public.prune_expired_data() from public, anon, authenticated;

commit;
