-- Removes the earlier prototype schema (role model admin|staff, clinics
-- owned via created_by) which was applied to the dev project before the
-- final design (admin|clinic + clinic_id, see following migrations) was
-- settled. Contained only demo data. Every statement is a no-op on a
-- fresh database, so the migration chain still bootstraps from zero.

drop table if exists public.profiles cascade;
drop table if exists public.clinics cascade;
drop table if exists public.settings cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.user_role() cascade;
