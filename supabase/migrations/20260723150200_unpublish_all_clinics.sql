-- Reset every clinic to draft (2026-07-23).
--
-- One-time state reset: at this point no law clinic should be publicly visible.
-- Going forward a clinic becomes published again only when it is complete and
-- either an admin publishes it or the clinic confirms its invite email.
--
-- Note: this unpublishes every currently-published clinic in whichever
-- environment it runs.

update public.clinics set is_published = false where is_published;
