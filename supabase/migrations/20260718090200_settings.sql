-- Settings: admin-configurable key/value store (chat model, system prompt, …).
-- The chat route reads these via the server-only service client, so no
-- anon policy is needed.

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
revoke insert, update, delete on public.settings from anon;

create policy "admins read settings"
  on public.settings for select
  to authenticated
  using (public.app_role() = 'admin');

create policy "admins insert settings"
  on public.settings for insert
  to authenticated
  with check (public.app_role() = 'admin');

create policy "admins update settings"
  on public.settings for update
  to authenticated
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');

create policy "admins delete settings"
  on public.settings for delete
  to authenticated
  using (public.app_role() = 'admin');
