-- Rename the nationwide region sentinel from "Deutschlandweit" to "Bundesweit".
-- The region column is free text and a few rows store it as one token inside a
-- comma-joined value (e.g. "Hamburg, deutschlandweit") with varying casing, so
-- replace the token in place (case-insensitive) rather than the whole cell.
update public.clinics
set region = regexp_replace(region, 'deutschlandweit', 'Bundesweit', 'gi')
where region ilike '%deutschlandweit%';
