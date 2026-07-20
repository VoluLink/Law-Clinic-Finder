-- Actually take contact_email away from anon.
--
-- The column-level revoke in 20260720120000 was a no-op: anon held a
-- TABLE-level SELECT on clinics, and a table grant covers every column
-- regardless of column-level revokes. The fix is to drop the table grant and
-- re-grant the columns anon is allowed to see.
--
-- Verified after applying: `set role anon; select contact_email from clinics`
-- returns "permission denied for table clinics", while name/region/website
-- still read normally for published rows.
--
-- The chat assistant still gives contact addresses out — its lookup runs on the
-- service-role client (src/app/api/chat/route.ts). What this closes is bulk
-- harvesting via PostgREST with the anon key that ships in the browser bundle.
revoke select on public.clinics from anon;

grant select (
  id, name, description, region, website, legal_areas,
  target_clients, languages, requirements, is_published,
  created_at, updated_at
) on public.clinics to anon;
