# Firebase Migration — Outstanding Work

Last updated: 2026-08-22

The application/runtime migration is complete. The full migration through public cutover remains
approximately **94% complete** because the owner does not yet have a final domain, final legal text,
or complete Brevo first-party DKIM. The site remains access-restricted staging. Supabase remains an
intact read-only source/rollback copy.

Legend: `[ ]` outstanding and `⛔` needs owner input or exact approval.

## Resume order

1. Finish and verify the first native GitHub-driven App Hosting rollout; the regional repository
   connection itself is complete.
2. Complete the post-copy Firestore content restore drill.
3. Obtain the domain, legal text, and Brevo DKIM; then perform public cutover and observation.
4. Provision the `smtpSettings` secret and the `idempotencyKeys` TTL so the implemented SMTP-admin
   and auth-mail feature can leave its read-only state.
5. Decide whether to archive unused Supabase migration code; keep Supabase data intact unless the
   owner separately authorizes a service/data change.

The operating conventions and safe commands are in
[`firebase-agent-playbook.md`](firebase-agent-playbook.md).

## 1 — Finish GitHub-driven App Hosting

The regional Developer Connect installation and repository link are complete: Firebase GitHub App,
`hackerFlo/Law-Clinic-Finder`, backend `web`, root `/`, branch `main`, region `europe-west4`. The
connection fetched and built GitHub commit `cc4ef327bbf7d0741c3672d56562972624bb1b3f` as READY build 009. The console's `getSourceCase` failure prevented creation of rollout 009, so traffic correctly
remains on verified rollout 008. Exact verification and recovery commands are in the playbook.

- [ ] Configure rollout triggers so documentation, tests, Functions-only changes, migration tools,
      and historical Supabase files do not consume App Hosting builds. Keep application/config paths
      build-triggering.
- [ ] ⛔ Publish the pending read-only `CI`, Dependabot, playbook, and plan changes after exact push
      authorization; require the repository `CI` check before merging to `main`.
- [ ] ⛔ After exact deployment/traffic authorization, trigger or allow a new GitHub-sourced rollout
      from the full reviewed `main` commit. Confirm App Hosting attributes it to that commit, then
      verify build READY, rollout SUCCEEDED, 100% traffic,
      `law-clinic-runtime`, staging 401/`no-store`, security headers, clean error logs, and absence of
      the unwanted broad build-account role.

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

The application side is implemented, tested, and merged-ready. The feature stays deliberately
read-only until the cloud resources below exist; until then the runtime keeps using the `SMTP_*`
environment variables.

- [x] Admin-only SMTP settings screen at `/admin/smtp` for provider-neutral host, port, TLS mode,
      login, password/key, sender address, and sender name. Secret fields show only as set/unset.
- [x] Active admin authorization, recent reauthentication, exact same-origin requests, strict Zod
      validation, per-admin rate limiting, and a required `Idempotency-Key` for every change.
- [x] Server-side verification with required TLS and authentication before one complete versioned
      Secret Manager payload is activated; the previous version is retained and re-activatable.
- [x] Brief per-warm-instance cache of the active configuration and a PII-/secret-free audit event
      containing actor ID, time, version, and changed field names only.
- [x] Login, invitation, and address-change e-mails redesigned to the approved branded template while
      preserving fragment-plus-POST privacy, expiry copy, escaping, multipart text, and provider
      neutrality.
- [x] Unit, authorization, validation, redaction, rollback, verification, accessibility, and
      emulator/E2E tests, including two Firestore concurrency tests for the idempotency claim.
- [ ] ⛔ Create the versioned secret `smtpSettings` in `europe-west4` after exact approval, and grant
      `law-clinic-runtime` only `secretmanager.versions.access` and `secretmanager.versions.add` on
      that single secret. No build identity and no other principal.
- [ ] ⛔ Add a Firestore TTL policy on `idempotencyKeys.expiresAt`.
- [ ] After provisioning: activate the first version from `/admin/smtp`, confirm a real magic-link
      delivery, then confirm a rollback re-activates the previous version. Only then may the
      `SMTP_LOGIN_EMAIL`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` secret references be considered for
      removal from `apphosting.yaml` — keep them until the secret-backed path is proven in staging.

## 5 — Optional Supabase code decommission

- [ ] After the rollback window, decide whether to archive/remove the development-only Supabase
      copy tooling, historical migrations, templates, and dependencies from the active repository.
- [ ] Before removal, prove every still-required seed/default has a Firebase-owned source and retain
      the audit/history needed for recovery.
- [ ] Re-run tracked-file, history, secret, PII, dependency, build-archive, and runtime-import checks.
- [ ] Keep the Supabase project and its data unchanged unless the owner gives separate, exact,
      destructive authorization. Code cleanup never implies cloud-data deletion.
