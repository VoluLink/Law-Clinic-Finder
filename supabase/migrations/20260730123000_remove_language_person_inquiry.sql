-- Infer language requirements only from the chat language, without a separate proxy inquiry.
-- Keep the live instructions and their admin reset baselines identical.

with replacement as (
  select
    $language_rule$   Die Sprache der ratsuchenden Person leitest du aus der Sprache ihrer Chatnachrichten ab und fragst
   NICHT danach. Nur wenn erkennbar für eine andere Person gefragt wird, deren Sprache abweichen könnte,
   stelle eine kurze Rückfrage zur Sprache dieser Person.
$language_rule$::text as previous_rule,
    $updated_language_rule$   Die Sprache der ratsuchenden Person leitest du aus der Sprache ihrer Chatnachrichten ab und fragst
   NICHT danach.
$updated_language_rule$::text as updated_rule
),
seed(key, value) as (
  select settings.key, to_jsonb(replace(settings.value #>> '{}', previous_rule, updated_rule))
  from public.settings as settings
  cross join replacement
  where settings.key in (
    'chat_system_prompt',
    'chat_system_prompt_default',
    'chat_skill',
    'chat_skill_default'
  )
)
insert into public.settings (key, value)
select key, value from seed
on conflict (key) do update
set value = excluded.value, updated_at = now();
