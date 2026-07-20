-- Final clinic schema, derived from the real directory spreadsheet
-- (trainingsdaten law clinics.xlsx, 2026-07-18):
--   Region  → region (free text; may be "Deutschlandweit" or a foreign place)
--   Rechtsgebiet → legal_areas as TEXT, not array: source values are messy
--     free text, substring search (ilike) matches far better than exact
--     array elements. ~60 rows, so index performance is irrelevant.
--   Mandanten → target_clients, Sprache → languages,
--   Andere Voraussetzungen (+ Beratungsarbeit note) → requirements.
-- The sheet has no street addresses → address dropped. contact_email stays:
-- it is the clinic's login/invite address, filled in by the admin.

alter table public.clinics rename column city to region;
alter index public.clinics_city_lower_idx rename to clinics_region_lower_idx;

alter table public.clinics drop column address;

drop index public.clinics_legal_areas_idx;
alter table public.clinics
  alter column legal_areas drop default,
  alter column legal_areas type text using array_to_string(legal_areas, '; '),
  alter column legal_areas set default '';

alter table public.clinics
  add column target_clients text,
  add column languages text,
  add column requirements text;

-- Natural key for idempotent spreadsheet imports (names are unique in the
-- source data).
alter table public.clinics add constraint clinics_name_key unique (name);

-- Column-level update grants follow renamed columns automatically; only the
-- new columns need granting (is_published stays service-client-only).
grant update (target_clients, languages, requirements) on public.clinics to authenticated;
