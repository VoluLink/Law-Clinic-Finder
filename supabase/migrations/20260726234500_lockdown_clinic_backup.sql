-- Retain the pre-normalization snapshot for controlled recovery only. It must
-- never be reachable through PostgREST or a service-role application client.
revoke all on public.clinics_backup_20260726
  from public, anon, authenticated, service_role;

alter table public.clinics_backup_20260726 enable row level security;
alter table public.clinics_backup_20260726 force row level security;
