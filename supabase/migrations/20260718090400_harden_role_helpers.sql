-- Advisor lint 0028: app_role()/app_clinic_id() were callable by anon via
-- /rest/v1/rpc. No anon RLS policy references them, so anon loses EXECUTE.
-- authenticated keeps it — RLS policies evaluate these as the caller, and
-- via RPC they only ever reveal the caller's own role/clinic (auth.uid()).

revoke execute on function public.app_role() from public, anon;
revoke execute on function public.app_clinic_id() from public, anon;
