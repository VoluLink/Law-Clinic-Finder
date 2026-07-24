-- Beratungsarbeit: does the clinic advise individual clients?
--
-- true  = the clinic advises clients (the common case; the default for legacy
--         and imported rows).
-- false = the clinic does not advise clients directly. It then must explain the
--         alternative service it provides (e.g. abstract law-reform projects) in
--         the description text — enforced by the app's publish/save validation,
--         not by a DB constraint, so incomplete drafts can still be stored.
--
-- Lives on clinic_submissions too, so a self-registered clinic carries its
-- answer through admin approval (which spreads the submission into clinics).

alter table public.clinics
  add column advises_clients boolean not null default true;

alter table public.clinic_submissions
  add column advises_clients boolean not null default true;

-- Members edit this from the portal (session client): UPDATE is column-level on
-- clinics, so the new column needs its own grant. SELECT stays table-level for
-- authenticated, and anon has no need for it (no public directory; chat reads
-- run on the service-role client).
grant update (advises_clients) on public.clinics to authenticated;
