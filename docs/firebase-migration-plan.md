# Firebase Migration — Outstanding Work

Last updated: 2026-08-22

The application/runtime migration is complete. The full migration through public cutover remains
approximately **94% complete** because the owner does not yet have a final domain, final legal text,
or complete Brevo first-party DKIM. The site remains access-restricted staging. Supabase remains an
intact read-only source/rollback copy.

Legend: `[ ]` outstanding and `⛔` needs owner input or exact approval.

## Resume order

1. Finish the one-time native GitHub connection for App Hosting.
2. Complete the post-copy Firestore content restore drill.
3. Obtain the domain, legal text, and Brevo DKIM; then perform public cutover and observation.
4. Implement the deferred SMTP-admin and auth-mail-design feature.
5. Decide whether to archive unused Supabase migration code; keep Supabase data intact unless the
   owner separately authorizes a service/data change.

The operating conventions and safe commands are in
[`firebase-agent-playbook.md`](firebase-agent-playbook.md).

## 1 — GitHub-driven App Hosting

- [ ] ⛔ In the Firebase/Google Cloud console, create a **data-residency-compliant** GitHub
      connection in `europe-west4`; install its GitHub App for only
      `hackerFlo/Law-Clinic-Finder`.
- [ ] Link backend `web` to repository root `/`, set live branch `main`, and enable automatic
      rollouts.
- [ ] Configure rollout triggers so documentation, tests, Functions-only changes, migration tools,
      and historical Supabase files do not consume App Hosting builds. Keep application/config paths
      build-triggering.
- [ ] Require the repository `CI` check before merging to `main`; use feature branch → pull request
      → green CI → merge for ordinary work.
- [ ] Push a harmless application-visible staging change through that workflow, confirm App Hosting
      attributes the rollout to the GitHub commit, then verify READY state, 100% traffic,
      `law-clinic-runtime`, staging 401/`no-store`, security headers, clean error logs, and absence of
      the unwanted broad build-account role.

Do not create the connection with the CLI: Google documents CLI-created GitHub connections as not
data-residency compliant. The one-time GitHub authorization therefore needs the owner's browser
approval.

## 2 — Post-copy content restore drill

- [ ] Wait for and identify the first READY Firestore backup whose snapshot is later than the
      completed `copy-20260822-staging` copy.
- [ ] ⛔ Obtain exact approval for a new temporary database ID in `europe-west4` and for deleting
      only that database after verification. The old approval for `restore-drill-20260822` is spent;
      that temporary database was already deleted.
- [ ] Restore the selected backup into the approved temporary database, verify application
      collection counts and representative references read-only, delete only the approved temporary
      database, and reverify `primary-eu` deletion protection plus source-backup READY state.

## 3 — Public cutover

### Owner inputs

- [ ] ⛔ Acquire and choose the final public domain.
- [ ] ⛔ Supply final, legally reviewed Impressum and Datenschutzerklärung content.
- [ ] ⛔ Complete Brevo sender-domain authentication with first-party DKIM.

### Implementation after the inputs exist

- [ ] Configure the custom App Hosting domain and HTTPS, Firebase authorized domain, canonical
      `siteUrl` secret, and Auth action/redirect links so every origin agrees exactly.
- [ ] Replace all legal placeholders and verify navigation/consent behavior in every public
      language.
- [ ] Recheck SMTP authentication, sender alignment, SPF/DKIM/DMARC, and a real magic-link delivery.
- [ ] Repeat unit, Functions, emulator, rules, migration, E2E, typecheck, lint, formatting, audit,
      production-build, live Auth, role, chat, clinic, admin, branding, logs, metrics, accessibility,
      and security checks.
- [ ] Remove `STAGING_ACCESS_ENABLED`, `STAGING_ACCESS_USERNAME`, and
      `STAGING_ACCESS_PASSWORD` only after all exit gates pass; deploy and switch public traffic.
- [ ] Observe Auth failures, SMTP failures, 4xx/5xx, Firestore operations, Cloud Run instances,
      latency, and Anthropic cost during the agreed rollback window; roll back on regression.
- [ ] Mark the migration complete in `README.md` and `CHANGELOG.md` after the observation window.

## 4 — Post-migration SMTP administration and e-mail design

- [ ] Add an admin-only SMTP settings screen for provider-neutral host, port, TLS mode, login,
      password/key, sender address, and sender name. Display secret fields only as set/unset.
- [ ] Require active admin authorization, recent reauthentication, exact same-origin requests, Zod
      validation, rate limiting, and an idempotency key for configuration changes.
- [ ] Test the proposed settings server-side with required TLS/authentication before atomically
      activating one complete versioned regional Secret Manager payload; retain a last-known-good
      version for rollback.
- [ ] Grant only narrow secret read/use permissions, cache the active configuration briefly per warm
      instance, and record a PII-/secret-free audit event containing actor ID, time, and changed field
      names only.
- [ ] Redesign login, invitation, and address-change HTML/text e-mails to match the intended visual
      formatting while preserving fragment-plus-POST privacy, expiry copy, escaping, multipart text,
      and provider neutrality.
- [ ] Add unit, authorization, validation, redaction, rollback, SMTP integration, accessibility, and
      emulator/E2E tests before enabling the feature.

## 5 — Optional Supabase code decommission

- [ ] After the rollback window, decide whether to archive/remove the development-only Supabase
      copy tooling, historical migrations, templates, and dependencies from the active repository.
- [ ] Before removal, prove every still-required seed/default has a Firebase-owned source and retain
      the audit/history needed for recovery.
- [ ] Re-run tracked-file, history, secret, PII, dependency, build-archive, and runtime-import checks.
- [ ] Keep the Supabase project and its data unchanged unless the owner gives separate, exact,
      destructive authorization. Code cleanup never implies cloud-data deletion.
