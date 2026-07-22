-- Logs: structured application logs (level/msg/fields) for the admin
-- "Protokolle" viewer. Written fire-and-forget by the service-role log sink;
-- read and cleared by admins under RLS. Retention is 7 days, pruned by the
-- app-side sink. Logs are PII-free by design (call sites pass only a short msg
-- plus reason/ids), so the table stays low-risk and safe to export.

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  msg text not null,
  fields jsonb
);

create index logs_logged_at_idx on public.logs (logged_at desc);
create index logs_level_idx on public.logs (level);

alter table public.logs enable row level security;
revoke select, insert, update, delete on public.logs from anon;
revoke insert, update, delete on public.logs from authenticated;

create policy "admins read logs"
  on public.logs for select
  to authenticated
  using (private.app_role() = 'admin');

create policy "admins delete logs"
  on public.logs for delete
  to authenticated
  using (private.app_role() = 'admin');
