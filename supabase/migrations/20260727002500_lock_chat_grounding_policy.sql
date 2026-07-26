-- Admins may edit normal assistant settings, but the evidence boundary is a
-- deployment-level security control. Protect that one row in RLS so bypassing
-- the admin form cannot weaken it; service_role remains able to migrate it.

drop policy if exists "admins insert settings" on public.settings;
create policy "admins insert settings"
  on public.settings for insert
  to authenticated
  with check (private.app_role() = 'admin' and key <> 'chat_grounding_policy');

drop policy if exists "admins update settings" on public.settings;
create policy "admins update settings"
  on public.settings for update
  to authenticated
  using (private.app_role() = 'admin' and key <> 'chat_grounding_policy')
  with check (private.app_role() = 'admin' and key <> 'chat_grounding_policy');

drop policy if exists "admins delete settings" on public.settings;
create policy "admins delete settings"
  on public.settings for delete
  to authenticated
  using (private.app_role() = 'admin' and key <> 'chat_grounding_policy');
