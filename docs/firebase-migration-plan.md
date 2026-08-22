# Firebase Migration Plan

Status: Phases 0–6 are complete. Phase 7 is complete except for DKIM and the content-level restore
drill, which require external DNS work and a new post-copy backup/approval. Phase 8 is in progress:
the final source reconciliation and independent verification are complete, while the public domain,
legal content, public traffic switch, and post-cutover observation remain blocked on user input. The
local application conversion is 100% complete and the full migration through production cutover is
approximately 94% complete. The EU cloud foundation and fail-closed staging gate are deployed;
Supabase remains unchanged.

Last updated: 2026-08-22

## Progress at a glance

Legend: `✅` complete, `🟡` in progress, `⛔` waiting for user authorization/access, and `⬜` not
started. Inside each phase, `[x]` is completed and `[ ]` is still outstanding.

| Phase | Scope                                      | Status                                  |
| ----: | ------------------------------------------ | --------------------------------------- |
|     0 | Decisions and safe baseline                | ✅ Complete                             |
|     1 | Provider-neutral boundaries and tests      | ✅ Complete                             |
|     2 | Firebase configuration and local emulators | ✅ Complete locally                     |
|     3 | Firestore repositories and invariants      | ✅ Complete locally                     |
|     4 | Firebase Auth and SMTP                     | ✅ Complete                             |
|     5 | Replace application reads and writes       | ✅ Complete locally                     |
|     6 | Data/user transfer tooling                 | ✅ Complete and verified                |
|     7 | Staging deployment and cloud security      | ⛔ Waiting on DNS/restore approval      |
|     8 | Production copy and cutover                | ⛔ Waiting on domain/legal inputs       |
|     9 | Optional later Supabase decommission       | ⬜ Not started; never automatic         |
|    10 | Post-migration mail administration/design  | ⬜ Deferred until migration completion  |
|    11 | Post-feature Firebase agent playbook       | ⬜ Deferred until all features are done |

### Deferred go-live reminders

The owner confirmed on 2026-08-22 that these prerequisites do not exist yet. Keep them visibly open
and remind the owner before any future public deployment:

- [ ] Acquire and choose the final public domain.
- [ ] Replace the Impressum and Datenschutzerklärung placeholders with final, legally reviewed text.
- [ ] Complete the Brevo sender/domain configuration, including first-party DKIM.
- [ ] After a post-copy backup becomes READY, obtain exact approval for a newly named temporary
      restore database, verify it read-only, and delete only that approved temporary database.
- [ ] Only after the preceding items: configure authorized domains/mail links, remove the staging
      gate, switch public traffic, and observe the monitoring exit window.

GitHub milestone: branch `feat/firebase-migration` is the first GitHub revision containing the
Firebase migration. It intentionally represents protected staging, not a public launch.

Current next action: obtain the final public domain and final Impressum/Datenschutz content, finish
Brevo DKIM in DNS, and wait for the first READY backup after the final copy. A new content-restore
database name and deletion require fresh exact approval because the previously approved temporary
database has already been deleted. Protected rollout `web-build-2026-08-22-007` passed emulator E2E,
live unauthenticated security/accessibility checks, explicit unknown-account handling, and a real
streaming/`after()` probe whose exact test records were removed afterward. The user also confirmed a
fresh protected magic-link login opened `/admin`.
The first real link on the preceding rollout was delivered through Brevo, consumed successfully,
and redirected the existing account into `/admin`; the user confirmed that the received message's
visual formatting is not the desired final design, which is explicitly deferred to Phase 10. The
final read-only source pass, explicit reconciliation of source-owned target paths, and a new
independent verification for `copy-20260822-staging` all completed with all six exact checksums. The
reconciliation never deletes additional Firebase documents; a read-only inventory found only the
intentional migration checkpoint and operational-alert setting beyond source-owned records. Do not
switch public traffic before the staging exit gate. Supabase remains read-only and intact.

Cloud state (reverified 2026-08-22): following explicit approval, the unintended empty `(default)`
Firestore database in `nam5` was permanently deleted. Named Standard database `primary-eu` now owns
the free tier in `europe-west4`, has deletion protection enabled, and has deny-all client rules,
minimal indexes/TTL policies, and a daily seven-day backup schedule. Five independently listed
backups are currently `READY`, proving that the schedule is operating. Storage and App Hosting
backend `web` are also in `europe-west4`. Identity Platform, disabled end-user signup/deletion,
authorized domains, and the deployed always-deny `beforeCreate` trigger are active. All seven App
Hosting secrets have enabled versions and only the dedicated runtime identity has accessor
bindings; secret values were never read during verification. Backend `web` serves the protected
staging rollout behind the HTTP Basic gate. Unauthenticated page/API requests and invalid
credentials return 401 with `no-store`; the CLI-restored broad build-account role has been removed
and verified. Login rollout
`web-build-2026-08-22-001` fixes the App Hosting public-origin/internal-Cloud-Run-host mismatch while
still rejecting every unconfigured Origin; its CLI-restored broad role was again removed and
verified absent. Rollout `web-build-2026-08-22-002` unifies the runtime database client and Firestore
value types under the Firebase Admin SDK after the Next.js production bundle exposed an incompatible
mixed-package instance; its quality gates, restricted runtime identity, access gate, and removal of
the CLI-restored broad role are verified. The replacement Supabase source key has been revalidated locally after the user
revoked the old key. After
explicit approval, copy run `copy-20260822-staging` wrote and independently verified all 169 prepared
documents, the single real Auth identity/profile, and the branding record (the source has no custom
logo object). Direct semantic checks
found 59 clinics (47 published) and valid identity, clinic, reservation, settings, branding, and
migration-run references. Supabase was read only and remains intact. Google Cloud CLI 581.0.0 is
installed successfully on this Mac; local user ADC exists with `law-clinic-finder` as its quota
project. The credential file remains outside the repository and its contents have not been read or
printed. The approved restore of the latest READY backup completed in isolated database
`restore-drill-20260822`; read-only counts proved that its August 21 snapshot predates the August 22
data copy and therefore contains no application collections. Only that temporary database was
deleted afterward; `primary-eu` remained protected and the source backup remained READY. A second
content-level restore drill remains due from the first READY backup taken after the staging copy.
The event-driven operational-alert synchronizer is ACTIVE with zero minimum and one maximum
instance under `law-clinic-monitoring`; it created one managed e-mail channel plus enabled built-in
Cloud Run 5xx and instance-cap policies without uptime polling or a custom log metric. Protected
revision `web-build-2026-08-22-007` serves 100% of staging traffic under `law-clinic-runtime`; its
access gate and post-rollout removal of the CLI-restored broad build role are reverified. Every
response now overwrites and propagates a validated UUID request ID into structured child loggers.

## Goal

Move the application from Supabase Postgres, Auth, Storage, and Supabase-hosted auth e-mail
delivery to:

- Firebase Authentication for identities.
- Cloud Firestore Standard edition for application data.
- Cloud Storage for Firebase for the branding logo.
- Firebase App Hosting for the existing Next.js application.
- Brevo SMTP for all authentication e-mails.

Target Firebase project: `law-clinic-finder`.

The public site, clinic portal, admin portal, passwordless login, signup/claim flows, chat,
statistics, retention behavior, and authorization boundaries must continue to behave as they do
before the migration. The migration must not expose contact addresses, transcripts, credentials,
or other private data to browser-side Firebase clients.

## Non-negotiable constraints

- Preserve the current UI and product behavior unless a Firebase limitation is explicitly recorded
  and approved.
- Keep the existing passwordless e-mail-link UX. Firebase creates the action code; Brevo SMTP sends
  the application-owned template.
- On an interactive login request, explicitly tell the visitor when no authorized Firebase
  identity/profile exists. This is an intentional, user-approved account-enumeration tradeoff;
  retain exact-origin checks, strict validation, generic infrastructure failures, and rate limits.
- Store auth state only in an `HttpOnly`, `Secure` (production), `SameSite=Lax`, bounded-lifetime
  session cookie. Do not persist Firebase ID or refresh tokens in browser storage.
- Keep authorization server-side and close to the data access. Proxy checks are only optimistic.
- Use Zod to validate every Firestore document and every external input at its boundary.
- Deny all Firestore and Storage client writes. Application writes go through authenticated Next.js
  route handlers using the Firebase Admin SDK and least-privilege IAM.
- Keep private contact e-mails separate from the public/searchable clinic document.
- Preserve the DB-only source of truth for assistant settings and prompts. There must be no code
  fallback for admin-editable prompt text.
- Do not put service-account JSON, Brevo credentials, exports, or PII in git.
- Copy Supabase data to Firebase without deleting or disabling the Supabase project or its data.
- Maintain automated backups and a tested restore procedure.

## Starting state and ownership warning

Baseline: branch `main`, commit `3c7077e`, Node `v22.22.2`, npm `10.9.7`.

The worktree was already dirty when this migration began. The existing changes implement chat
daily-quota and access work and belong to the user/other ongoing work. They must be preserved and
incorporated, not reverted or overwritten. At discovery time the modified/untracked application
files included:

- `README.md`
- `src/app/api/chat/route.ts`
- `src/components/chat/FinderChat.tsx` and its test
- `src/lib/chat/handle-chat.ts` and its test
- `src/lib/chat/schema.ts` and its test
- `src/lib/rate-limit.ts` and its test
- `src/lib/chat/daily-quota.ts` and its tests
- `supabase/migrations/20260815120000_add_chat_daily_quota.sql`

Always run `git status --short` before editing. Treat any additional changes as user-owned unless
their origin is known.

Discovery quality-gate baseline:

- `npm test`: pass, 98 files / 708 tests.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run format:check`: pre-existing failure in ignored/local `LOCAL-TESTING.md` and
  `WHICH-COPY.md`; do not rewrite those files without permission.

## Recommended architecture

### Hosting and location

Use Firebase App Hosting in `europe-west4` (Netherlands) and create Firestore and Storage in the
same region. This is currently the only listed EU App Hosting region and avoids cross-region
latency/egress. Germany is not currently an App Hosting location. Firebase Hosting can proxy a
Cloud Run container in Frankfurt, but Firebase Hosting imposes a hard 60-second timeout on dynamic
requests; that is unsafe for the multi-call streaming chat. Configure `minInstances: 0`,
conservative `maxInstances`, default/high concurrency, and 512 MiB memory initially. Add budget
alerts before production traffic.

Firebase App Hosting supports Next.js through its framework adapter, but the currently installed
Next.js 16.2 version is newer than Firebase's actively supported Next.js line and is therefore a
preview-risk combination. First deploy a non-production backend and run the full parity suite. If
the adapter fails or changes runtime behavior, keep Next.js 16 and evaluate direct Cloud Run in
Frankfurt behind a Google load balancer. Do not put the streaming route behind Firebase Hosting's
60-second proxy and do not downgrade Next.js without a separate decision.

App Hosting requires the Blaze plan, although its underlying services and Firestore have no-cost
allowances. Budget alerts do not cap spending, so runtime limits and abuse controls remain required.

### Server boundary

Use the Firebase Admin SDK only in server-only modules. In App Hosting it will use Application
Default Credentials; local development uses the Emulator Suite or a local ADC credential outside
the repository. Do not ship a service-account private key as a public/build variable.

Browser code will not connect directly to Firestore or Storage. Initial rules therefore fail closed:

```text
Firestore: deny all client reads and writes
Storage: allow public reads only for the current branding object; deny all client writes
```

This deliberately replaces Supabase RLS with a narrower trust boundary: validated server data
access functions perform authentication, role checks, clinic ownership checks, and safe DTO
projection before every operation. The App Hosting runtime identity must receive only the IAM roles
needed for Auth administration, Firestore document access, and the branding bucket.

### Authentication and Brevo SMTP

Use Firebase's Admin SDK to create or import users and generate Firebase e-mail sign-in action
links. Insert the generated link into local HTML/text templates and send it through a provider-
neutral SMTP adapter configured by server name, port, login e-mail, password, sender, and TLS mode.
Brevo is the initial provider, but changing provider must require configuration only, not code
changes. This keeps Firebase responsible for the one-time authentication code and the configured
SMTP provider responsible for delivery.

The login flow will be:

1. Validate and rate-limit the submitted e-mail address.
2. Look up an existing authorized Firebase user/profile. Return an explicit not-signed-up result
   when it is absent, while keeping delivery/infrastructure failures generic.
3. Create a random, short-lived state value. Store only its hash plus user ID, purpose, expiry, and
   attempt/lease state in Firestore; do not put the e-mail address in the URL.
4. Ask Firebase Admin to generate a sign-in link whose continuation URL carries the raw state.
5. Send the link through Brevo SMTP.
6. `/auth/confirm` atomically claims the state, obtains the user's e-mail from Firebase Auth, and
   completes Firebase's e-mail-link exchange.
7. Exchange the returned ID token for a short-lived Firebase session cookie, then discard client
   token state.
8. On first activation, transactionally set `activatedAt` and auto-publish a complete, approved
   clinic exactly once.

All protected data operations call a central DAL that verifies the Firebase session and loads the
current profile. Deleting a profile or revoking access therefore takes effect even if a signed
session cookie has not expired. Sensitive account changes additionally require recent auth.

Signup remains server-controlled. Accounts without a valid `profiles/{uid}` record have no
application access. Production hardening disables end-user account creation/deletion in Identity
Platform and adds an always-deny `beforeCreate` blocking function as defense in depth. Only trusted
server workflows use the Admin SDK to create or import users; Admin SDK operations do not trigger
blocking functions. This prevents direct use of Firebase's public Auth API from creating orphan
accounts without paying for an authorization-document read on every attempted signup. The user
approved the Identity Platform upgrade on 2026-08-16.

Existing Supabase sessions cannot be converted to Firebase sessions. Imported users retain their
UID and e-mail identity but must use one new magic link after cutover. The source is not in public
use and only the owner currently has access, so no user-facing migration window is required.

### Firestore data model

Names below use camelCase in code. Migration decoders accept the current snake_case SQL fields and
write only the new canonical shape.

| Collection/document                        | Purpose and important fields                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinics/{clinicId}`                       | Directory and workflow data: name, description, region, website, legalAreas, targetClients, languages, requirements, advisesClients, isPublished, approvalStatus, createdAt, updatedAt. No contact e-mail. |
| `clinicContacts/{clinicId}`                | Server-only `contactEmail`; read only after role/tool authorization.                                                                                                                                       |
| `profiles/{uid}`                           | `role`, `clinicId`, `accessStatus`, `activatedAt`, timestamps. Current document is authoritative for access.                                                                                               |
| `uniqueClinicNames/{nameHash}`             | Transactional reservation enforcing the former unique clinic-name constraint.                                                                                                                              |
| `uniqueClinicOwners/{clinicId}`            | Transactional reservation enforcing one login/profile per clinic.                                                                                                                                          |
| `emailOwners/{emailHash}`                  | Transactional reservation enforcing e-mail uniqueness across admin and clinic identities without putting PII in document IDs.                                                                              |
| `settings/chat`                            | All live chat settings, immutable reset baselines, and grounding policy in one validated server-only document.                                                                                             |
| `settings/operations`                      | Immutable selected admin UID for operational alerts. The current address is resolved from Firebase Auth and is never duplicated in Firestore.                                                              |
| `branding/current`                         | Validated theme record and Storage object reference.                                                                                                                                                       |
| `conversations/{conversationId}`           | One summary per chat: session ID, redaction status, detected terms, match/message counts, model, cumulative tokens, recommendation IDs, timestamps, expiry.                                                |
| `conversationTranscripts/{conversationId}` | Redacted transcript only. A retention-state document keeps exactly the newest 200 transcript IDs and deletes the evicted detail document.                                                                  |
| `clinicEvents/{eventId}`                   | PII-free recommendation/click event with clinic ID, kind, optional conversation ID, createdAt, expiresAt.                                                                                                  |
| `clinicMetrics/{clinicId}/months/{yyyyMm}` | Write-time monthly counters for recommendations and clicks, avoiding full event scans.                                                                                                                     |
| `adminMetrics/{yyyyMm}`                    | Monthly conversation count, match count, day buckets, legal-area buckets, and token totals by model for a one-document dashboard read.                                                                     |
| `claimLimits/{clinicId}`                   | At most the relevant two send timestamps for the rolling seven-day claim limit.                                                                                                                            |
| `chatDailyQuotas/{dateAndDeviceHash}`      | Two session IDs and their turn counts; updated in a Firestore transaction and expired by TTL.                                                                                                              |
| `authEmailStates/{stateHash}`              | Short-lived, one-time e-mail-action state tied to a UID and purpose. TTL field is not indexed.                                                                                                             |
| `logs/{logId}`                             | PII-free structured log with seven-day TTL. Cloud Logging remains the operational source; this collection preserves the admin viewer.                                                                      |
| `migrationRuns/{runId}`                    | Non-PII migration phase, count/checksum, and completion metadata for resumability and idempotency.                                                                                                         |

Timestamps used only for TTL receive single-field index exemptions. Large prompt, transcript, and
log-field values that are never queried are also exempted from indexing. Composite indexes are
created only for query shapes exercised by the application and tests.

### Database invariants formerly supplied by Postgres

Firestore does not supply joins, foreign keys, triggers, RLS, or SQL unique constraints. Preserve
them explicitly:

- Use transactions plus reservation documents for clinic name, clinic ownership, and identity
  e-mail uniqueness.
- Every clinic-member read/write takes the clinic ID only from the freshly loaded active profile;
  never trust a body/path clinic ID as ownership proof.
- `approvalStatus !== approved` always forces `isPublished = false` in the same transaction.
- Clinic deletion resolves and removes the linked profile/Auth user and unpublishes/deletes related
  resources through an idempotent service operation. A repair audit detects orphans.
- Removing an admin is a transaction over an admin counter/reservation and cannot remove the caller
  or the last admin.
- Conversation upsert, recommendation de-duplication, metric deltas, and transcript-cap bookkeeping
  execute transactionally/idempotently.
- Daily chat quota claims use a Firestore transaction so multiple App Hosting instances cannot race.
- Firestore TTL replaces `pg_cron` for 7-day logs, daily auth/quota state, and 12-month events,
  conversations, and claim history. Queries also apply the cutoff because TTL deletion can lag.
- Settings migrations are versioned scripts recorded in `migrationRuns`; admin-editable values stay
  in Firestore and are never shadowed by code defaults.

### Cost controls

- Keep all request-time code in the App Hosting process; do not add callable Functions for ordinary
  routes.
- `minInstances: 0`; cap `maxInstances` initially and retain high safe concurrency.
- Store assistant settings and branding as singleton documents.
- Maintain monthly metric documents at write time instead of repeatedly scanning events.
- Keep the searchable directory free of contact e-mail and load/cached sanitized published rows once
  per server cache window. Invalidate after clinic writes.
- Use Firestore aggregation queries or metric documents instead of reading rows only to count them.
- Exempt non-query and TTL fields from indexes to reduce storage/write amplification.
- Use TTL instead of scheduled cleanup Functions.
- Keep Storage to the current branding asset and delete the replaced object after a successful write.
- Retain the existing in-process per-IP burst limits and the distributed Firestore daily quota.
- Add Firebase/GCP budget alerts and usage dashboards before production traffic.

## Behavioral parity checklist

The migration is incomplete until all items pass against the Firebase emulator and the staging
backend:

- [x] Public landing page, nine languages, RTL behavior, branding, analytics consent.
- [x] Finder chat availability, streaming NDJSON, tools, recommendation cards, no-match/completed
      states, daily quota, per-IP burst limit, redaction, persistence, and cost accounting.
- [x] Published-clinic search semantics including partial multi-value matching and `Bundesweit`.
- [x] Recommendation tool never exposes contact e-mail before a validated recommendation.
- [x] Passwordless login explicitly identifies an unregistered address, while rate limiting,
      exact-origin validation, and generic delivery/infrastructure errors remain enforced.
- [x] Brevo sends login, invite, replacement-link, and verified e-mail-change messages.
- [x] First activation publishes only complete/approved clinics and never republishes later.
- [x] Signup paths: claim with stored e-mail, claim without stored e-mail/pending approval, and new
      clinic registration.
- [x] Pending clinic sees only `/clinic/pending`; data APIs independently deny access.
- [x] Clinic can edit only its own record and cannot publish itself.
- [x] Clinic statistics show rolling counters and the eight-week chart.
- [x] Clinic account deletion removes access and unpublishes while retaining the directory record.
- [x] Admin clinic CRUD, invite/resend/reset, approval/rejection, admin management, assistant settings,
      branding/logo, dashboard, transcript deletion, and logs.
- [x] Admin cannot remove self or the last admin; e-mail uniqueness holds across roles.
- [x] Retention: newest 200 transcripts, 7-day logs, 12-month analytics/event window, short-lived
      auth state, and daily quota expiry.
- [x] No browser can read/write Firestore directly or upload Storage objects.
- [x] Auth/session failure paths return generic client messages and PII-free structured logs.

Parity evidence: colocated unit tests cover each domain invariant and mail purpose; Firestore/Auth/
Storage emulator tests cover transaction and rule boundaries; nine Playwright journeys cover public,
RTL, consent, role, explicit-login, and accessibility behavior; protected staging proves real Brevo
delivery/admin login plus App Hosting streaming and deferred `after()` persistence.

## Implementation phases

### Phase 0 — Decisions and safe baseline

- [x] Read repository rules, project map, relevant Next.js 16 docs, auth guidance, and current
      Firebase primary documentation.
- [x] Inventory Supabase calls, SQL schema/functions/triggers/RLS, Auth flows, Storage, retention,
      chat quota, and hosting constraints.
- [x] Record the dirty-worktree baseline and run quality gates.
- [x] Save this resumable plan.
- [x] Resolve the questions below and record answers in the decision log.
- [x] Re-run `git status --short`; do not start overlapping edits while the existing quota work is
      changing in another tool/session.

Exit gate met: target project/location/billing/cutover choices are explicit and existing work is
accounted for.

### Phase 1 — Tests and provider-neutral boundaries (TDD)

- [x] Add failing contract tests for datastore, identity, mail, object storage, transaction, clock,
      and ID-generation ports.
- [x] Supersede the temporary Supabase-adapter step by moving runtime behavior directly behind small
      domain repositories; only the isolated read-only migration source retains a Supabase client.
- [x] Keep pure business logic and route dependency injection independent of Firebase types.
- [x] Add parity fixtures/codecs for every transferred shape and focused tests for every invariant
      listed above.

Exit gate met: provider ports, document codecs, migration fixtures, and domain tests pass without a
runtime Supabase import.

### Phase 2 — Firebase project configuration and emulator

- [x] Add `firebase-admin`, the minimal Auth client/exchange support, Nodemailer, Firebase CLI/rules
      test dependencies, and pinned Node engine compatible with App Hosting.
- [x] Add validated Firebase/Brevo environment configuration and update `.env.example` without
      secrets.
- [x] Add `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`,
      `storage.rules`, and `apphosting.yaml`.
- [x] Configure the Emulator Suite for Auth, Firestore, Functions, and Storage.
- [x] Add rule tests proving all direct Firestore writes/private reads fail and only the branding
      object is publicly readable.

Exit gate: emulators start reproducibly; deny-by-default rule tests pass.

### Phase 3 — Firestore repositories and invariants (TDD)

- [x] Implement Zod document codecs and server-only Admin initialization.
- [x] Implement clinic/contact/profile/settings/branding repositories, including admin CRUD.
- [x] Implement unique reservation documents and transactional clinic/admin workflows.
- [x] Implement chat search with equivalent matching and a sanitized directory cache.
- [x] Implement conversation/event persistence, monthly metrics, transcript cap, TTL fields, and
      distributed daily quota.
- [x] Implement PII-free log sink with TTL.
- [x] Seed assistant settings/defaults/grounding through the checksummed, idempotent copy run.

Exit gate: repository/integration tests pass against Firestore Emulator, including races and retries.

### Phase 4 — Firebase Auth and Brevo (TDD)

- [x] Implement Firebase action-link generation and provider-neutral SMTP transport/templates.
- [x] Implement one-time action state, e-mail-link exchange, CSRF binding, session-cookie
      creation/verification/deletion, expiry, and revocation behavior.
- [x] Replace Supabase login, confirm, signout, invitation, dev-login, account deletion, and admin
      e-mail-change code.
- [x] Enforce recent authentication for sensitive account changes.
- [x] Add and test the approved Identity Platform `beforeCreate` blocking function. Deployment and
      console configuration remain Phase 7 work.
- [x] Add abuse tests: enumeration, replay, expired link, wrong purpose, concurrent confirmation,
      forged cookie, revoked/deleted profile, and cross-role access.
- [x] Use the Firebase Admin Firestore module for both the named database client and all Firestore
      value types so production bundling cannot create incompatible SDK instances.

Exit gate: all auth journeys pass in Emulator/staging and tokens never persist in browser storage.

### Phase 5 — Replace application reads/writes

- [x] Move public page, chat tools, clinic portal, admin pages, API routes, instrumentation, import
      utilities, and branding upload to the Firebase repositories.
- [x] Replace Supabase proxy refresh logic with an optimistic Firebase-cookie check; retain secure
      DAL checks at each data operation.
- [x] Remove Supabase types from runtime/domain logic. Supabase JS and the direct low-level Google
      Firestore client remain dev dependencies only for ignored local copy/import tooling; a
      regression test keeps both out of runtime source and production dependency declarations.
- [x] Update the canonical `README.md` architecture, environment, commands, security model, retention,
      and deployment sections in the same change.
- [x] Update `CHANGELOG.md`.

Exit gate: no runtime source imports `@supabase/*`; unit/integration/E2E parity suite passes.

### Phase 6 — Idempotent data and user transfer tooling

- [x] Build a dry-run-by-default migration CLI with Zod validation, explicit source/target project
      checks, count/checksum reporting, batch limits, and `migrationRuns` checkpoints.
- [x] Read Supabase data directly into bounded memory and write Firebase without creating plaintext
      exports in the repository.
- [x] Import Auth users in batches of at most 1,000, preserving UID, e-mail, verified/disabled state,
      and app role/profile references. Do not import Supabase sessions.
- [x] Exclude the exact reserved `admin@example.com` and `startright@example.com` development
      identities and their access profiles from the Firebase target without deleting source rows.
- [x] Transform clinics/contact e-mails, profiles, settings/default prompts, branding/logo,
      conversations/transcripts, clinic events, claim limits, and retained logs.
- [x] Rebuild reservations and metrics from source records; do not trust derived target counts.
- [x] Treat the current day's anonymous quota as ephemeral and reset it at cutover unless direct
      private-schema export is available and explicitly requested.
- [x] Add read-only exact document count/checksum verification and Auth/profile UID alignment.
- [x] Run the copier against the real Supabase source in dry-run mode. It completed without a
      Firebase connection or source mutation and validated 169 target documents across six
      checksummed phases.
- [x] Reverify before staging copy that `primary-eu` has zero root collections and Firebase Auth has
      zero users; confirm local ADC can perform both read-only checks.
- [x] Re-run the real-source dry-run after ADC setup. The first read received Supabase's known
      transient `JWT issued at future` response; the unchanged retry validated the same 169 target
      documents and six phase checksums without writing to either provider.
- [x] Install Google Cloud CLI 581.0.0 and create local user ADC with `law-clinic-finder` as its
      quota project. No service-account key was created or downloaded.
- [x] User explicitly authorized the first idempotent staging copy into `law-clinic-finder` /
      `primary-eu` and confirmed the protected staging page opens with the existing credentials.
- [x] Apply and independently verify the approved staging copy using run
      `copy-20260822-staging`; all six phase checksums, Auth identities, and the branding record
      match. The source contains no custom logo object.
- [x] Add an explicit `--apply --reconcile` mode for the same matching run. It revalidates stored
      checkpoints, rewrites only exact source-owned document paths, imports only missing matching
      identities, and never deletes target-only runtime records. Use it only after a final source
      read detects expected-path drift.
- [x] Run direct semantic verification for identity/profile, clinic/contact, name/owner reservation,
      settings, branding, published-clinic query, and completed migration-run references.
- [x] Hand off live settings, published-clinic, Auth/SMTP, and role behavior verification to the
      protected application parity gate in Phase 7.

Exit gate: fixture migration and staging migration are repeatable, verified, and resumable.

#### Completed local ADC setup

Verified against Google's Apple-silicon instructions on 2026-08-22 for Google Cloud CLI 581.0.0.
The `rapid` archive changed after an earlier check on the same date, so always recheck the current
version and SHA-256 in the official installation guide immediately before use. The CLI archive now
passes checksum verification and is extracted. Its first installation attempt failed safely before
making CLI configuration changes because macOS supplied Python 3.9.6, while this CLI requires Python
3.10 or newer. Install Python 3.14.7 from python.org, verify the package, and then resume. Run one
line at a time; no placeholder needs replacing:

```bash
cd "$HOME"
curl -fLO https://www.python.org/ftp/python/3.14.7/python-3.14.7-macos11.pkg
echo '70c5239ad2d62925d2947e46921d0ddd3d35be3d2f0a2d50db33da507dbcb419  python-3.14.7-macos11.pkg' | shasum -a 256 -c -
pkgutil --check-signature python-3.14.7-macos11.pkg
open python-3.14.7-macos11.pkg
export CLOUDSDK_PYTHON="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
"$CLOUDSDK_PYTHON" --version
"$HOME/google-cloud-sdk/install.sh"
"$HOME/google-cloud-sdk/bin/gcloud" init
"$HOME/google-cloud-sdk/bin/gcloud" auth application-default login
"$HOME/google-cloud-sdk/bin/gcloud" auth application-default set-quota-project law-clinic-finder
test -f "$HOME/.config/gcloud/application_default_credentials.json" && echo 'ADC is ready.'
```

Use the same Google account that owns `law-clinic-finder`. Browser login is expected. The ADC file
contains a refresh token and must remain local; it is outside the repository and can later be revoked
with `"$HOME/google-cloud-sdk/bin/gcloud" auth application-default revoke`. Do not print or send the
file contents.

### Phase 7 — Staging deployment and security/parity audit

- [x] Upgrade `law-clinic-finder` to Blaze and enable the App Hosting and Firestore APIs.
- [x] Delete the unintended empty `nam5` default database after explicit approval; create protected
      named Standard database `primary-eu` in `europe-west4` as the project's free-tier database.
- [x] Create the Firebase Web app, regional Storage bucket, and no-rollout App Hosting backend `web`
      in `europe-west4`, with `minInstances: 0` and `maxInstances: 3` in configuration.
- [x] Configure Identity Platform e-mail-link Auth, authorized Firebase/App Hosting domains,
      disabled end-user signup/deletion, and improved e-mail privacy. The application-owned one-time
      state enforces 15 minutes because Identity Platform exposes no action-code-expiry setting here.
- [x] Deploy and register the always-deny `beforeCreate` blocking function in `europe-west4`; retain
      one day of build images to minimize Artifact Registry cost.
- [x] Deploy named-database rules, minimal indexes/TTL exemptions, and Storage rules. App Check is
      not an applicable data boundary because browser code never calls Firestore/Storage/Auth SDKs
      directly; the public Auth REST exchange remains server-side.
- [x] Move backend `web` to a dedicated runtime service account. Give it the required App Hosting
      runner role, a six-permission custom Auth role, and Firestore access conditioned on
      `primary-eu`; keep the CLI's default build account out of application data access. Restrict the
      web key to Identity Toolkit and Secure Token APIs.
- [x] Store the Auth API key, canonical hosted URL, and existing Anthropic key in regional Secret
      Manager and grant only backend `web` access.
- [x] Store the Brevo SMTP login/password/sender secrets, verify enabled versions without reading
      their values, and grant backend `web` access through `law-clinic-runtime`.
- [x] Confirm live revision `web-build-2026-08-22-001` references version 1 of all three SMTP
      secrets and complete a TLS-required Brevo SMTP authentication handshake on port 587 without
      sending a message or printing any credential. Brevo accepted the stored login and SMTP key.
- [x] Parse App Hosting's appended `X-Forwarded-For` chain from the trusted right-hand side so a
      client-supplied prefix cannot bypass per-IP limits.
- [x] Confirm the configured Brevo sender is verified and DMARC is configured. This is sufficient
      for restricted test sends; the dashboard still shows the default-DKIM warning.
- [ ] Authenticate the Brevo sender domain with its own DKIM record before production traffic.
- [x] Add a temporary fail-closed HTTP Basic staging gate. It uses a 20+ character Secret Manager
      password, runs before pages and APIs, strips credentials before forwarding, marks successful
      responses `private, no-store`, costs no Firestore operations, and remains disabled in local
      development unless explicitly enabled.
- [x] Create enabled version 1 of `stagingAccessPassword` without reading it and grant backend `web`
      access through its dedicated runtime identity.
- [x] Create the first protected source rollout. The first attempt failed closed before compilation
      because `firebaseWebApiKey` lacked backend access; grant backend `web` only the required seven
      secret references and complete rollout `build-2026-08-16-002` successfully.
- [x] After the first Firebase CLI source rollout, remove its automatically restored
      `roles/firebase.sdkAdminServiceAgent` binding from the default build account and re-verify that
      only `law-clinic-runtime` has application data access. Repeat after every future rollout.
- [x] Configure a daily Firestore backup with seven-day retention in `europe-west4`; recheck the
      schedule and confirm that five generated backups are independently listed as `READY`.
- [x] Configure a billing budget/limit; the user confirmed this is already in place.
- [x] Inventory operational monitoring: there are currently no alert policies, uptime checks, or
      custom log metrics. Choose built-in Cloud Run metrics so the staging gate is not polled awake
      and route-based log metrics do not add avoidable logging/metric usage.
- [x] Add an admin-only selector for the operational-alert recipient. Persist only the selected
      immutable admin UID in the protected `settings/operations` document, resolve the current
      address from Firebase Auth, default to the sole admin or oldest active admin by profile
      `createdAt`, and fall back to the oldest remaining active admin if the selection becomes invalid.
- [x] Create low-cost Cloud Run 5xx and instance-cap alert policies and synchronize their managed
      e-mail notification channel only when the admin selection changes. Run the event function as
      a dedicated least-privilege identity with zero minimum instances; do not poll the backend or
      grant Monitoring mutation roles to the App Hosting runtime.
- [x] Run pre-rollout unit quality gates and the Next.js production build: 127 test files / 798
      tests, TypeScript, lint, touched-file formatting, and build pass.
- [x] Diagnose the first live login failure as an App Hosting origin/host mismatch: the browser sent
      the configured public Origin but Cloud Run exposed its internal request URL, so the exact
      direct-host check returned 403 before Auth or SMTP ran.
- [x] Add a proxy regression test and restrict the fallback to the validated canonical site Origin;
      direct same-origin requests still pass and unconfigured Origins still fail.
- [x] Pass 127 test files / 800 tests, typecheck, lint, touched-file formatting, and the Next.js
      production build; deploy protected rollout `web-build-2026-08-22-001`.
- [x] Remove and verify absence of the broad `roles/firebase.sdkAdminServiceAgent` binding that the
      Firebase CLI restored even during its App Hosting dry-run. Confirm `law-clinic-runtime` serves
      the new revision and the unauthenticated staging gate still returns 401 plus `no-store`.
- [x] Diagnose the subsequent live delivery failure before SMTP: Cloud logs showed the generic
      delivery error while a related query exposed incompatible `FieldPath` package instances. The
      runtime had created its database with `@google-cloud/firestore` but used value types from
      `firebase-admin/firestore`, which the production Next.js bundle loaded separately.
- [x] Unify the named-database client and all value types under `firebase-admin/firestore`; pass the
      focused regression tests, the three Firestore-emulator transaction tests, 127 test files / 800
      tests, typecheck, lint, touched-file formatting, and the production build.
- [x] Deploy protected rollout `web-build-2026-08-22-002`, verify it is ready under
      `law-clinic-runtime`, remove the CLI-restored broad role and confirm its binding count is zero,
      and reverify the unauthenticated 401 plus `no-store` staging gate.
- [x] User opened the protected URL with username `preview` and the existing private staging
      password and confirmed the landing page appears. The password was not sent or recorded.
- [x] User requested a magic login link for the existing account in protected staging, Brevo
      delivered it, and the same browser consumed it successfully and opened `/admin`. The account
      address, link, code, and preview password are not recorded in this file.
- [x] Locally keep one-time action codes/state out of request URLs: put them in the e-mail URL
      fragment, clear it from browser history, submit it through a strict same-origin/rate-limited
      POST, allow only fixed local destinations, and retain generic failures and one-time semantics.
- [x] Pass 131 test files / 819 tests, the three Firestore-emulator transaction tests, typecheck,
      lint, touched-file formatting, `git diff --check`, the Next.js production build, and a headless
      production-browser smoke proving fake action values never enter a network URL.
- [x] Deploy the fragment-plus-POST flow as `web-build-2026-08-22-003`, verify the dedicated runtime
      identity, remove the CLI-restored broad role and confirm its binding count is zero, and recheck
      the unauthenticated 401 plus `no-store` staging gate.
- [x] Complete a focused OWASP A01–A10 review of the confirmation, staging-gate, session, origin,
      rate-limit, logging, and analytics boundaries. Prevent third-party analytics from initializing
      on `/auth/confirm` and strictly validate the GA4 ID before nonce-authorized script interpolation.
- [x] Pass 132 root test files / 823 tests, the three Firestore-emulator transaction tests,
      typecheck, lint, touched-file formatting, `git diff --check`, and the production build after
      the focused security remediation.
- [x] Deploy protected rollout `web-build-2026-08-22-004`, verify it is ready at 100% traffic under
      `law-clinic-runtime`, remove the CLI-restored broad role and confirm its binding count is zero,
      and recheck the unauthenticated 401 plus `no-store` staging gate.
- [x] User consumed a new rollout `web-build-2026-08-22-004` link and confirmed it opened `/admin`.
      Sanitized Cloud Run logs independently show GET `/auth/confirm` without query parameters,
      POST `/api/auth/confirm` without query parameters, `auth confirm succeeded`, and GET `/admin`
      returning 200; no action code, state, address, or preview credential was printed.
- [x] Return a distinct, strictly validated `not_registered` result for a missing Auth identity or
      authorized profile and show a direct German error in the login form. Keep SMTP/infrastructure
      failures generic and preserve exact-origin checks plus per-IP rate limits.
- [x] Deploy operational-alert selection and the explicit login result as
      `web-build-2026-08-22-005`; pass 136 root test files / 835 tests, the three Firestore-emulator
      transaction tests, four Functions test files / nine tests, Functions/root typechecks, lint,
      touched-file formatting, and the production build. Confirm 100% traffic, the dedicated App
      Hosting identity, zero broad build-role bindings, and an unauthenticated 401 plus `no-store`.
- [x] Create the default `settings/operations` selection idempotently, then verify the event-driven
      synchronizer created one enabled managed e-mail channel and enabled built-in Cloud Run 5xx and
      instance-cap policies. The trigger is ACTIVE on exact database `primary-eu`, has zero minimum
      and one maximum instance, and runs as the dedicated `law-clinic-monitoring` identity.
- [x] Close the admin-status time-of-check/time-of-use gap by revalidating both `role=admin` and
      `accessStatus=active` inside the Firestore write transaction. Pass 137 root test files / 836
      tests, typecheck, lint, formatting, `git diff --check`, and production build; deploy protected
      rollout `web-build-2026-08-22-006` at 100% traffic, verify `law-clinic-runtime`, remove the
      CLI-restored broad role, and recheck unauthenticated 401 plus `no-store`.
- [x] Run authenticated browser E2E parity journeys, accessibility smoke checks, and staging-focused
      secure-code checks. Nine emulator-backed Playwright journeys pass across public languages/RTL,
      consent, explicit unknown login, admin, clinic, cross-role denial, and Axe checks; protected
      staging separately passes public security/accessibility probes and real admin login.
- [x] Verify Next.js streaming and `after()` behavior on App Hosting. A non-PII protected-staging
      chat returned incremental NDJSON, completed in about 2.4 seconds, and exposed the persisted
      two-message conversation after about 2.8 seconds. The exact test conversation and quota record
      were deleted through the production cleanup path; no fallback is needed.
- [x] Generate a fresh UUID request ID at the trusted proxy boundary, overwrite untrusted inbound
      values, return it on every response, and propagate it through structured route logger children.
- [x] Restore the latest READY `primary-eu` backup into the explicitly approved temporary
      `restore-drill-20260822` database, verify it read-only without printing PII, delete only that
      temporary database afterward, and confirm `primary-eu` remains deletion-protected plus the
      source backup remains READY. The August 21 snapshot predates the August 22 application copy,
      so this proves restore mechanics and isolation but intentionally contains no app collections.
- [ ] Repeat a content-level restore drill from the first READY backup whose snapshot is after the
      August 22 staging copy; verify non-PII counts/checksums in a newly approved temporary database
      and delete only that temporary database afterward.

Pre-deployment checklist state:

- [x] The exact two reserved test identities and their profiles are excluded from the Firebase copy;
      the Supabase rows remain untouched.
- [x] App Hosting does not set `DEV_LOGIN_ENABLED`, production mode disables the route independently,
      and the source archive excludes all `.env` files and migration-only Supabase code.
- [x] Per-IP limiting ignores forgeable `X-Forwarded-For` prefixes and uses Google's appended client
      position.
- [x] The Firebase hosted URL, authorized domains, application-owned mail templates, and 15-minute
      one-time state agree; the old Supabase action URL/template settings are not runtime inputs.
- [x] Use the explicitly approved access-restricted staging approach while Impressum and
      Datenschutz operator placeholders remain. Replace them before removing the staging gate.
- [x] Create a replacement Supabase secret key named `firebase-migration-20260816`, update only the
      local migration environment, and validate it with the complete read-only 169-document source
      dry-run. The first request hit Supabase's transient `JWT issued at future` clock-skew error;
      the unchanged retry passed with the expected counts and checksums.
- [x] User revoked only the old, previously cloud-synced Supabase secret key. The unchanged
      replacement key then passed the complete 169-document read-only source dry-run again; all
      Supabase data/project resources remain intact.

Exit gate: staging parity/security checklist is signed off and rollback has been rehearsed.

### Phase 8 — Production cutover

- [x] Surface the repository's live-environment checklist before publishing.
- [ ] Complete the remaining live checklist inputs: final public domain, authorized domain/link
      origins, real Impressum, real Datenschutzerklärung, and Brevo DKIM.
- [x] Confirm the Supabase source counts. No user-facing write freeze is needed because the source is
      not in use.
- [x] Take source counts/checksums, reconcile the final source-owned paths, and independently verify
      all 169 prepared documents, one Auth identity, and the branding record. Read-only inventory
      proves there are no additional target business records.
- [x] Deploy and smoke-test the access-restricted Firebase backend in `europe-west4`.
- [ ] Configure the final domain/authorized domain/Brevo links and repeat the smoke test.
- [ ] Switch traffic only after Auth, chat, clinic, admin, logo, logs, and metrics checks pass.
- [x] Keep Supabase intact and unchanged after the copy; do not delete or disable its data.
- [ ] Monitor 4xx/5xx, Auth failures, Firestore operations, Cloud Run instances, e-mail failures,
      latency, Anthropic streaming, and spend alerts.

Rollback: switch traffic back to the previous deployment, restore Supabase writes if they were
frozen, and retain the Firebase copy for diagnosis. Do not attempt a reverse merge without a
separate validated tool because writes may have diverged.

### Phase 9 — Decommission Supabase

- [ ] After the agreed rollback period, take a final encrypted/offline backup and verify retention.
- [ ] Remove Supabase packages, active clients, auth-config script, e-mail templates, environment
      variables, and deployment secrets.
- [ ] Remove or archive obsolete SQL only after every seed/default has a Firebase migration source.
- [ ] Re-run secret/history checks and verify no migration artifacts or PII are tracked.
- [ ] Disable Supabase only with explicit user confirmation; deletion is a separate destructive step.
- [ ] Mark this plan complete and leave the final architecture/status in `README.md`.

Exit gate: production operates solely on Firebase/Brevo and rollback retention obligations are met.

### Phase 10 — Post-migration mail administration and design (explicitly deferred)

This phase starts only after the Firebase migration and production cutover are complete and signed
off. It is intentionally excluded from the migration-completion percentage above.

- [ ] Add an admin-only SMTP settings section for provider-neutral host, port, TLS mode, login,
      sender address, sender name, and a write-only password/key field.
- [ ] Redesign the login, invitation, and address-change HTML/text e-mails to match the user's desired
      formatting. Start from the existing reference templates under `supabase/email-templates/`, ask
      the user to confirm the exact visual target at implementation time, retain accessible plain-text
      fallbacks, and test representative Gmail/Apple Mail/mobile rendering before activation.
- [ ] Require an authenticated admin, current admin role, recent re-authentication, same-origin
      validation, strict Zod validation, and rate limiting for every read/test/update endpoint.
- [ ] Store each complete active SMTP configuration as one versioned Secret Manager payload. Never
      store the password/key in Firestore, browser storage, HTML, logs, audit records, or API
      responses; return only non-secret fields and a `hasPassword` flag.
- [ ] Test the proposed configuration server-side with TLS and SMTP authentication before atomically
      activating it. Keep the preceding secret version available for a deliberate rollback.
- [ ] Give the App Hosting runtime read-only access to the active SMTP secret. Give the narrowly
      scoped update path permission to version only that secret, never project-wide Secret Manager
      administration.
- [ ] Cache the active configuration briefly per warm instance so provider changes do not require a
      deployment while routine requests avoid extra Secret Manager reads and cost.
- [ ] Record a redacted audit event containing actor, time, and changed field names only; never record
      SMTP values or credentials.
- [ ] Add unit, authorization, validation, rollback, redaction, and integration tests before enabling
      the section in production.

Exit gate: an admin can validate, activate, and roll back an SMTP provider without deployment, and
no secret can be retrieved through the UI, application API, Firestore, logs, or audit history.

### Phase 11 — Firebase agent operations playbook (explicitly deferred)

This phase starts only after all product features, including Phase 10, are implemented and accepted.
It is intentionally excluded from the migration-completion percentage above.

- [ ] Write the canonical, concise Firebase working conventions into `README.md` so a new agent can
      orient without rediscovering the project.
- [ ] Document exact project/database/region pins, ADC and emulator-first setup, TDD and validation
      boundaries, idempotent migrations, read-only preflights, and approval requirements for data
      mutation, deploy, IAM, restore, deletion, and cutover work.
- [ ] Document least-privilege runtime identities, Secret Manager rules, App Hosting post-deploy IAM
      cleanup, deny-by-default client rules, structured PII-free logging, request correlation,
      backups/restore drills, monitoring, rollback, and cost controls.
- [ ] Add a focused local Firebase operations skill for both assistants only if it materially reduces
      mistakes; keep `.codex` and `.claude` synchronized with `sync-agent-config.sh` and local-only.
- [ ] Validate the playbook by having a fresh agent follow it through a safe emulator-only change,
      then remove ambiguity and stale commands found by that exercise.

Exit gate: a fresh agent can make, test, review, and safely stage a Firebase change using one
authoritative convention without broad IAM, secret exposure, accidental production mutation, or
unnecessary Firebase usage.

## Cutover verification counts

Record values during staging and production. Do not record e-mail addresses, transcript content, or
other PII in this file.

| Item                              |                                                Supabase count/hash |                                                Firebase count/hash | Status |
| --------------------------------- | -----------------------------------------------------------------: | -----------------------------------------------------------------: | ------ |
| Auth users                        |                                                                  1 |                                                                  1 | match  |
| Profiles                          |                                                                  1 |                                                                  1 | match  |
| Clinics                           |                                                                 59 |                                                                 59 | match  |
| Published clinics                 |                                                                 47 |                                                                 47 | match  |
| Settings canonical hash           | `ac7e49852a559bc65ae4d7fef42bba73033f61af9c556be66a3603ad56c08fba` | `ac7e49852a559bc65ae4d7fef42bba73033f61af9c556be66a3603ad56c08fba` | match  |
| Conversations in retention window |                                                                 13 |                                                                 13 | match  |
| Redacted transcripts retained     |                                                                 13 |                                                                 13 | match  |
| Clinic events in retention window |                                                                 11 |                                                                 11 | match  |
| Logs in seven-day window          |                                                                  0 |                                                                  0 | match  |
| Branding record hash              | `e9cefc20cc34fc0c14f6412ed9d9180eba84d7d155a66a7b0bec0c561e6462e2` | `e9cefc20cc34fc0c14f6412ed9d9180eba84d7d155a66a7b0bec0c561e6462e2` | match  |

The source has no custom logo object, so there is no Storage object checksum to compare. The target
has exactly one additional `migrationRuns` checkpoint and one additional `settings/operations`
document; both are intentional PII-free Firebase runtime state, not copied business data.

## Confirmed decisions

1. “Firefly” means Google Firebase; use Cloud Firestore Standard for the database.
2. The existing target Firebase project ID is `law-clinic-finder`.
3. Use Firebase App Hosting, Firestore, and Storage in `europe-west4` because App Hosting has no
   German region and the Frankfurt Firebase Hosting/Cloud Run route has a 60-second dynamic timeout.
4. Supabase is not currently used by public users. Copy its data; never delete or disable the source
   data as part of this migration.
5. Only the owner currently has service access, so forcing a new Firebase magic-link login at
   cutover is acceptable.
6. Use a provider-neutral SMTP adapter configured by server name, port, login e-mail, password,
   sender, and TLS. Brevo is the initial provider; provider changes are configuration-only.
7. Enable Firebase Authentication with Identity Platform and deploy an account-creation blocking
   function.
8. Use App Hosting first for reliable full-stack/AI streaming. Keep a direct Cloud Run fallback only
   for an observed Next.js 16 adapter incompatibility.
9. The user explicitly approved deleting only the unintended empty `(default)` Firestore database;
   use protected named database `primary-eu` in `europe-west4` and keep Supabase untouched.
10. Operational alerts are addressed to an admin selected in the admin panel; without an explicit
    selection, use the sole admin or the admin with the oldest profile `createdAt`.
11. After every feature is complete, write and validate the secure, efficient Firebase agent
    operations playbook described in Phase 11.
12. Push the completed-as-far-as-possible migration as the first Firebase GitHub revision while
    keeping domain, legal text, Brevo DKIM, restore, and public cutover reminders open.

## Decision log

| Date       | Decision                                                   | Reason                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-16 | Use project `law-clinic-finder`                            | Existing Firebase target confirmed by the user.                                                                                                                                             |
| 2026-08-16 | Use Firestore Standard and Storage in `europe-west4`       | App Hosting has no German region; co-location in its EU region avoids latency and egress.                                                                                                   |
| 2026-08-16 | Use App Hosting first, direct Cloud Run only as fallback   | Firebase Hosting's Cloud Run proxy has a 60-second timeout that can break the streaming multi-call chat.                                                                                    |
| 2026-08-16 | Use server-only Firestore and HttpOnly Firebase sessions   | Closest secure replacement for RLS/cookie SSR while minimizing browser SDK surface and duplicate reads.                                                                                     |
| 2026-08-16 | Use Firebase-generated links through provider-neutral SMTP | Avoids custom authentication tokens and permits changing SMTP providers through configuration.                                                                                              |
| 2026-08-16 | Enable Identity Platform blocking auth                     | Prevent direct public Auth API use from creating unauthorized/orphan accounts.                                                                                                              |
| 2026-08-16 | Disable end-user signup and always deny `beforeCreate`     | Admin SDK creation/import bypasses the hook; no authorization document or per-attempt Firestore read is needed.                                                                             |
| 2026-08-16 | Copy Supabase without deletion                             | The source is not live, and the user explicitly requires all Supabase data to remain intact.                                                                                                |
| 2026-08-16 | Use named database `primary-eu`                            | User approved deleting the unintended empty default; the named database preserves the project ID, EU locality, and free tier.                                                               |
| 2026-08-16 | Restrict the App Hosting runtime                           | A dedicated runtime identity, custom Auth role, and `primary-eu` IAM condition isolate application access from Firebase's default build account.                                            |
| 2026-08-16 | Password-protect the temporary staging URL                 | A fail-closed HTTP Basic gate protects pages/APIs without Firestore reads or extra identities; its strong password remains in Secret Manager.                                               |
| 2026-08-22 | Disclose an unknown login address                          | User explicitly prefers a direct not-registered error; exact-origin checks, strict validation, rate limits, and generic infrastructure failures limit the intentional enumeration tradeoff. |
| 2026-08-22 | Event-driven operational alerts                            | Store only an admin UID, resolve the current Auth address at sync time, use built-in metrics, and keep the zero-minimum synchronizer outside the App Hosting runtime identity.              |
| 2026-08-22 | Separate mechanics/content restore drills                  | The approved pre-copy backup proves isolated restoration; a post-copy READY backup is required to prove application-content recovery.                                                       |

## Progress log

| Date       | Checkpoint                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-16 | Discovery and baseline       | Supabase schema/flows inventoried; 708 tests, typecheck, and lint pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-16 | Architecture decisions       | Firebase project, EU region, SMTP abstraction, Identity Platform, copy-only migration, and hosting strategy set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-16 | Phase 1 started              | Provider-neutral boundary tests and Firebase foundation are the active work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-16 | Firebase local foundation    | Added validated env, Admin SDK, App Hosting config, emulators, indexes, deny-by-default rules, and six passing rules tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-16 | Auth foundation              | Added SMTP delivery, Firebase e-mail links, one-time state, Identity Toolkit exchange, secure session cookies, role guard, and blocking function with focused tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-08-16 | Cloud status                 | Firebase CLI is authenticated and `law-clinic-finder` is selected. The project was initially on Spark with no registered Firebase apps or deployed Functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-16 | Blaze and API enablement     | The owner upgraded to Blaze. App Hosting and Firestore APIs are enabled; no App Hosting backend or Firebase Web app exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-16 | Region correction blocked    | While enabling Firestore, `firebase deploy --only firestore` silently created the missing empty `(default)` database in `nam5`, published deny-all rules, and began indexes/TTL setup. The deploy was stopped; no Auth users or source data were copied and Supabase was untouched. The default-resource location remains immutable after deletion. Recommended correction: explicitly approve deleting this empty database, create the next/free-tier database as a named `europe-west4` database, and configure the server/rules for that ID. Alternative: a fresh EU-initialized project.                                                                                                                                                                                                                                                                   |
| 2026-08-16 | EU database corrected        | After explicit user approval, deleted only the empty unintended `(default)` database and created deletion-protected Standard database `primary-eu` in `europe-west4` with the project's free tier. Runtime, migration, emulator, and deploy configuration now require the named database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Firebase data services       | Deployed deny-all Firestore client rules, minimal indexes/TTL policies, and Storage rules to regional resources. Created the `europe-west4` Storage bucket and a daily seven-day Firestore backup schedule. No application records were written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-16 | Identity Platform live       | Enabled passwordless e-mail Auth, disabled end-user signup/deletion, enabled improved e-mail privacy, authorized Firebase and App Hosting domains, and deployed/registered the always-deny `beforeCreate` function in `europe-west4`. A one-day function image cleanup policy is active.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-16 | App Hosting foundation       | Registered the Firebase Web app and created backend `web` in `europe-west4` without GitHub linkage, build, rollout, or traffic. Stored the site URL, Firebase Auth key, and existing Anthropic key as regional secrets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-16 | SMTP secrets ready           | Confirmed enabled version 1 for `smtpLoginEmail`, `smtpPassword`, and `smtpFromEmail` without reading any value, then granted backend `web` access through the dedicated `law-clinic-runtime` identity. Brevo sender/domain dashboard verification remains outstanding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-16 | Proxy rate-limit fix         | Google App Hosting appends its trusted client and load-balancer addresses to any incoming `X-Forwarded-For` value. The app now reads and validates the trusted client position from the right, so a forged prefix cannot bypass per-IP limits; focused tests cover forged, single, and malformed headers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Pre-rollout quality gate     | Root suite: 125 test files and 790 tests pass, with 3 files/10 emulator-only tests skipped by the root command; typecheck, lint, and the Next.js production build pass. The production audit remains at the documented six moderate transitive `uuid` findings with no compatible upstream fix. Full-repository Prettier still reports only the two pre-existing local notes `LOCAL-TESTING.md` and `WHICH-COPY.md`; all touched files pass.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-16 | Restricted staging gate      | Confirmed the Brevo sender is verified and DMARC is configured; default DKIM remains test-only. Added a runtime-only, Secret-Manager-backed HTTP Basic gate that protects pages and APIs, fails closed on invalid configuration, strips the credential upstream, and requires no Firebase data reads. The user confirmed billing protection is configured. Focused gate/proxy tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Staging secret ready         | Confirmed enabled version 1 of `stagingAccessPassword` without reading its value and idempotently granted App Hosting backend `web` access through the dedicated runtime identity. The secret-value command was never used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-16 | Staging-gate quality gate    | Root suite: 126 test files and 797 tests pass, with 3 files/10 emulator-only tests skipped by the root command. Typecheck, lint, production build, touched-file Prettier, YAML parsing, and `git diff --check` pass. A local production smoke test returns 401 for unauthenticated page/API requests and 200 plus `private, no-store` for valid credentials. The build emits only the expected absent-local-Firebase-config warning. Full Prettier still reports only the two pre-existing user-owned notes.                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-16 | Cloud least privilege        | Moved backend `web` to `law-clinic-runtime`, with only App Hosting runner access, six Auth permissions, `primary-eu`-conditioned Firestore access, and its three regional secrets. The default build account has no application data role. Restricted the Firebase Web API key to Identity Toolkit and Secure Token APIs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Post-cloud quality gate      | Typecheck, lint, Functions test/build, 124 root test files with 786 passing tests, production build, six rules tests, three transaction-race tests, and migration apply/resume/verify emulator test pass. Only the two known unrelated local notes remain outside full-repository Prettier compliance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-16 | Dependency audit             | Production audits report six root and seven Functions moderate entries from the same `uuid`/Google Storage chain; the full dev tree reports nine. Current Firebase Admin/Functions versions expose no compatible upstream fix, and npm's proposed downgrade is not accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-16 | Public data paths            | Clinic search/terms/recommendations, settings, branding, chat quota, conversation retention/events/metrics, click beacons, and logs now use server-only Firebase adapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-16 | Firebase authentication      | Login delivery, one-time confirmation, HttpOnly sessions, first-access publication, signout, role checks, and optimistic proxy routing now use Firebase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-08-16 | Security hardening           | SVG/PNG branding uploads are decoded and re-encoded as PNG before Storage, removing active SVG content while preserving upload support.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-08-16 | Signup and provisioning      | Clinic search, stored-address claims, supplied-address pending claims, registrations, invitations, access review/revocation, and admin-account provisioning now use Firebase. Claim sends use a transactional two-per-seven-day Firestore limiter with TTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-16 | Admin and account paths      | Admin dashboard/CRUD, metrics, profile management, verified e-mail changes with recent-auth enforcement, and emulator-only dev login now use Firebase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-16 | Runtime cutover local        | Active `src/` runtime imports no Supabase package. Supabase JS is retained only as a development dependency for read-only source copying.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Transfer tooling             | Added bounded, dry-run-first source reads, strict project confirmation, non-empty-target refusal, resumable checksummed phases, Auth UID import, logo normalization, and read-only verification. The apply/resume/verify target path passes against Auth/Firestore/Storage emulators.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-16 | Local security tests         | Deny-by-default Firestore/Storage rules pass six emulator tests; migration target apply/resume/verify passes its emulator integration test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-08-16 | Transaction race tests       | Firestore Emulator proves exactly-once e-mail-state consumption, two-per-window claim limiting, and unique clinic-name creation under concurrent calls. The Admin SDK successfully retries the emulator's expected lock contention.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-16 | Real-source dry run          | Completed read-only after correcting the legacy `claim_requests` retention column from `created_at` to `sent_at`. After excluding the two exact reserved development identities and their access profiles from the target only, the source validated into 169 target documents: clinics 118, identities 3, configuration 2, conversations 27, analytics 19, operations 0. No Firebase connection/write or Supabase mutation occurred.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-16 | Source key replacement       | Stored the newly named Supabase secret key only in ignored `.env.local`; only `.env.example` is tracked or present in Git history. The first read-only check received Supabase's transient `JWT issued at future` response, and the unchanged retry completed with the expected 169-document counts/checksums. The old key still needs user-side revocation; no source or Firebase data changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-16 | Old source key revoked       | User confirmed revocation of only the old cloud-synced Supabase key. The first post-revocation read received the same transient `JWT issued at future` response; the unchanged retry authenticated with the replacement key and reproduced all six checksums and 169 prepared documents. No Firebase write or Supabase mutation occurred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-16 | Protected staging live       | Opened the tested source-rollout guard after key rotation and passed 127 test files / 798 tests, typecheck, lint, formatting, and the Next.js production build. The first cloud build failed closed because the Auth web-key secret lacked backend access; all seven references were granted only to `law-clinic-runtime`, and rollout `build-2026-08-16-002` succeeded in `europe-west4`. Page/API requests without valid Basic credentials return 401 plus `no-store`. The CLI-restored broad build-account role was removed and least privilege reverified.                                                                                                                                                                                                                                                                                                 |
| 2026-08-22 | Resume revalidation          | Confirmed the successful rollout remains active, the broad build-account role remains absent, the access gate still returns 401 plus `no-store`, and the target still has zero Auth users and zero Firestore root collections. The Mac is Apple silicon and has neither Homebrew, Google Cloud CLI, nor local ADC. Recorded Google's checksum-verified CLI/ADC setup commands; staging data copy remains blocked pending explicit authorization.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-22 | CLI Python prerequisite      | The corrected Google Cloud CLI 581.0.0 Apple-silicon archive passed SHA-256 verification and was extracted. Installation then stopped safely because the Mac only has Python 3.9.6 and this CLI requires 3.10 or newer. Recorded the checksum-verified official Python 3.14.7 macOS installer and the explicit `CLOUDSDK_PYTHON` recovery path. No Firebase or Supabase data changed; local ADC is still absent.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-22 | Google Cloud CLI installed   | Installed Google Cloud CLI 581.0.0 successfully after supplying Python 3.14.7; the CLI reports its bundled Python 3.14.6 component and current core components. Local ADC is still the next required setup step. No Firebase or Supabase data changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-22 | Local ADC ready              | Signed in to Google Cloud as the project owner, selected `law-clinic-finder`, created local Application Default Credentials, and attached the same project for quota. The credential stays outside the repository and was not printed. No Firebase or Supabase data changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-22 | Copy preflight ready         | Used local ADC for read-only checks: Firebase Auth still has zero users and `primary-eu` still has zero root collections. The first source dry-run received Supabase's known transient `JWT issued at future` response; an unchanged retry validated the same 169 prepared documents and six checksums (118 clinics, 3 identities, 2 configuration, 27 conversations, 19 analytics, 0 operations). No writes occurred. The first real copy now waits only for explicit user approval.                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-22 | Staging copy verified        | After explicit approval and exact-target/empty-target checks, run `copy-20260822-staging` copied the source into `law-clinic-finder` / `primary-eu`. The apply pass and a separate verification pass matched all six checksums, Auth identities, and the branding record; the source has no custom logo object. Direct semantic checks found 59 clinics (47 published), one real Auth/profile identity, and valid reference invariants. Supabase was read only and remains intact.                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-08-22 | App Hosting origin fix       | The first real login POST returned 403 before Auth/SMTP because App Hosting preserved the public browser Origin while Cloud Run exposed an internal request URL. Added a tested exact canonical-origin fallback without accepting foreign Origins; 127 files/800 tests, typecheck, lint, formatting, and production build pass. Deployed `web-build-2026-08-22-001`, reverified the 401/`no-store` staging gate and dedicated runtime identity, and removed the broad build role that Firebase CLI restored even during dry-run.                                                                                                                                                                                                                                                                                                                               |
| 2026-08-22 | Brevo SMTP auth verified     | Confirmed the live revision binds version 1 of the regional SMTP login, password, and sender secrets through the dedicated runtime identity. A real TLS-required authentication handshake to `smtp-relay.brevo.com:587` succeeded using the stored login and SMTP key; no email was sent and no credential was printed. Firebase contains one admin profile/Auth identity; the exact address was shown only in chat after explicit permission and was not written to project files.                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-08-22 | Firestore runtime fix        | Live requests reached the delivery path but failed before SMTP; a related query exposed that the production bundle treated direct `@google-cloud/firestore` and `firebase-admin/firestore` values as different package instances. Unified the named database client and value types under the Admin SDK, passed focused/emulator/full gates, deployed `web-build-2026-08-22-002`, reverified the protected gate and dedicated runtime identity, and removed the CLI-restored broad role. A fresh real login request remains the delivery proof.                                                                                                                                                                                                                                                                                                                |
| 2026-08-22 | Live admin login verified    | The user confirmed delivery and successful sign-in; PII-free application logs also show the request handled, confirmation succeeded, and `/admin` served. The delivered message works but does not match the user's desired visual formatting, so template redesign is recorded as a Phase 10 follow-up. Cloud Run's automatic request URL exposed the already-consumed one-time query parameters to restricted project logs; fragment-plus-POST hardening is now active Phase 7 work.                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-08-22 | Auth URL hardening deployed  | New auth links carry code/state only in a URL fragment; the page clears browser history and sends a strict payload to the Same-Origin/rate-limited POST API, whose destination is a fixed local enum. Focused tests, 131 files/819 tests, Firestore emulator, typecheck, lint, formatting, build, and production-browser smoke pass. Deployed `web-build-2026-08-22-003`, reverified the gate/runtime identity, and removed the broad role. The user reports receiving the fresh mail; confirmation into `/admin` and the clean live URL proof remain.                                                                                                                                                                                                                                                                                                         |
| 2026-08-22 | Backup schedule operating    | Re-read the `primary-eu` daily schedule and independently listed five generated backups in `READY` state, each with the configured seven-day retention. No restore, database creation, deletion, or Supabase operation was performed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-22 | Monitoring inventory         | Confirmed that the project currently has no alert policies, uptime checks, or custom log metrics. The low-cost design will use built-in Cloud Run 5xx and instance-count metrics, avoid waking the zero-minimum staging backend with uptime polling, and avoid route-based custom log metrics. Creating the notification channel waits for the user's chosen alert address because Google sends an external verification message.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-22 | Auth security follow-up      | A focused A01–A10 pass found no high-risk defect. It closed two privacy/configuration gaps: `/auth/confirm` now initializes no third-party analytics while the fragment exists, and only a strictly validated GA4 measurement ID can enter the nonce-authorized setup script. Focused tests, typecheck, and lint pass. The known moderate transitive Firebase Storage dependency advisory and pending operational alerts remain documented residuals.                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-08-22 | Auth privacy rollout         | Passed 132 root test files / 823 tests, the three Firestore transaction tests, typecheck, lint, touched-file formatting, `git diff --check`, and the production build. Deployed `web-build-2026-08-22-004` behind the unchanged staging gate at 100% traffic, verified `law-clinic-runtime`, removed the CLI-restored broad role to zero bindings, and rechecked unauthenticated 401 plus `no-store`. A new real link remains the live confirmation/log proof.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-22 | Hardened login proven        | The user confirmed a fresh protected magic link opened `/admin`; sanitized Cloud Run logs independently showed query-free confirmation requests, a successful confirmation event, and a 200 admin response without printing code, state, address, or preview credentials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-08-22 | Restore mechanics drilled    | Restored the latest READY August 21 backup into approved isolated database `restore-drill-20260822`, verified read-only that it predates the August 22 copy and has no app collections, deleted only the temporary database, and reverified deletion protection on `primary-eu` plus READY state on the source backup. A post-copy content drill remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-08-22 | Operational alerts live      | Added the active-admin selector and oldest-active default, persisted only the immutable UID, and deployed an exact-`primary-eu` write trigger under a dedicated least-privilege identity. It created one enabled managed e-mail channel and built-in 5xx/instance-cap policies with zero minimum and one maximum function instance, no uptime polling, and no custom log metric.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-22 | Login disclosure rollout     | Added the user-approved explicit not-registered result while retaining generic SMTP failures, validation, same-origin controls, and rate limits. All root/Functions/emulator/type/lint/build gates passed; `web-build-2026-08-22-005` serves 100% behind the staging gate, the broad build role is absent, and unauthenticated requests still receive 401 plus `no-store`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-22 | Alert selection race closed  | Added a transaction-level recheck that the selected profile remains both an admin and active, then passed 137 root test files / 836 tests, typecheck, lint, formatting, diff, and production build. Protected rollout `web-build-2026-08-22-006` serves 100% under `law-clinic-runtime`; the broad CLI-restored build role was removed again and the unauthenticated gate still returns 401 plus `no-store`.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-08-22 | Parity and correlation pass  | Added trusted-boundary UUID request correlation and emulator-only Playwright role/public/accessibility journeys. Nine E2E tests pass. Protected rollout `web-build-2026-08-22-007` passed live public security/accessibility, unknown-account, foreign-Origin, and denied-direct-Firestore probes. One non-PII chat proved incremental NDJSON plus deferred persistence; its exact conversation/quota records were deleted afterward. The broad build role was removed again.                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-22 | Final source reconciliation  | A fresh source dry-run reproduced the same 169 prepared documents and six checksums. Staging runtime activity had legitimately changed source-owned aggregate timestamps, so the migration tool gained a guarded `--apply --reconcile` mode with emulator tests. It rewrote only exact expected paths under the same matching run and never deletes extras. Independent verification then passed; read-only inventory found no additional target business records. Supabase remained read-only and intact.                                                                                                                                                                                                                                                                                                                                                     |
| 2026-08-22 | Final local quality gate     | Root: 138 test files / 842 tests pass (3 files / 11 tests skipped for their dedicated emulator commands), typecheck, lint, production build, touched-file formatting, and `git diff --check` pass. Functions: 4 files / 9 tests plus build pass. Firestore transactions 3/3, rules 6/6, migration reconciliation 2/2, and Playwright 9/9 pass. No runtime Supabase import, tracked secret pattern, or broad build-account role remains. The full Prettier check still reports only the two pre-existing local files recorded in the baseline.                                                                                                                                                                                                                                                                                                                  |
| 2026-08-22 | Autonomous closure preflight | Reconfirmed read-only that `primary-eu` remains deletion-protected in `europe-west4`, the daily seven-day backup schedule is active, protected App Hosting still uses Node 22 in `europe-west4`, and the broad default build-account role remains absent. All five READY backups still predate the staging copy, so no restore database was created. Moved the direct low-level Google Firestore client to dev-only beside Supabase JS and added deployment-boundary regression coverage. Root gates pass with 138 files / 846 tests, typecheck, lint, formatting, and production build. The tracked/history scan still finds only `.env.example`, the ignored `.env.local` remains untracked, build output contains no migration/Supabase source, and audits remain at the documented moderate-only upstream Firebase chain with zero high/critical findings. |
| 2026-08-16 | Focused security review      | Completed local OWASP A01–A10 review. Added exact-origin gates to authenticated writes/signout, nonce CSP and response headers, HTTPS-only production origins/source copy, HTTP(S)-only clinic URLs, and stricter clinic-import arguments. No critical/high code finding remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-08-16 | Local quality gate           | Root: 124 test files / 783 tests pass (3 files / 10 tests skipped outside their emulator command), typecheck and lint pass. Functions test/build, six rules tests, three transaction-race tests, migration apply/resume/verify emulator test, production build, and production-browser CSP/hydration smoke check pass. The suite uses two threads to avoid fork startup failures under memory pressure.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Local OWASP A01–A10 security review

Scope: Firebase/Auth/SMTP runtime paths, Firestore/Storage rules, transfer/import tools, secrets,
dependencies, the production Next.js response surface, and completed Phase 7 cloud controls.
DKIM and the post-copy content restore drill remain open; the latter cannot start until a new READY
backup exists and a new temporary database is explicitly approved.

| OWASP area                       | Local result and evidence                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control        | Pass locally: Firestore client access is denied (`firestore.rules:3-7`), Storage writes/private reads are denied (`storage.rules:3-12`), protected routes reload the current profile, and authenticated mutations reject non-matching origins (`src/lib/auth/admin-guard.ts:10-23`).                                                                                                                     |
| A02 Cryptographic Failures       | Pass locally: Firebase verifies/revokes signed sessions; production cookies are HttpOnly/Secure/SameSite-Lax and bounded (`src/lib/firebase/session.ts:44-81`). Auth state/action codes and reservation IDs are hashed; SMTP requires TLS 1.2+ (`src/lib/mail/smtp.ts:39-47`).                                                                                                                           |
| A03 Injection                    | Pass after remediation: all route/document boundaries use Zod; clinic links allow only HTTP(S) (`src/lib/clinics/schema.ts:14-21`); logo input is decoded/re-encoded; runtime contains no SQL/shell construction; optional GA4 configuration is format-validated before interpolation into a nonce-authorized script.                                                                                    |
| A04 Insecure Design              | Accepted intentional tradeoff: login explicitly distinguishes an unknown/unauthorized address at the user's request. Exact-origin enforcement, strict Zod validation, per-IP rate limits, one-time state, transactional reservations/quotas, server-only Admin SDK, retention caps, and generic SMTP/infrastructure failures remain. Validate limits across the capped three-instance staging backend.   |
| A05 Security Misconfiguration    | Pass with staging work open: strict nonce CSP plus HSTS/frame/MIME/referrer/permissions headers (`src/lib/http/security-headers.ts:6-34`), fixed IDs, deny rules, least-privilege IAM, Identity restrictions, TTL, backups, runtime caps, billing protection, a fail-closed staging gate, and built-in operational alert policies are configured. Authenticated response and DKIM checks remain.         |
| A06 Vulnerable Components        | Medium residual: `npm audit --omit=dev` reports the transitive `uuid` buffer-bounds advisory through current Firebase Admin/Google Storage (six root, seven Functions entries). No high/critical advisory exists and npm only proposes incompatible downgrades. Monitor and upgrade immediately when Google publishes a compatible chain; do not use `--force`.                                          |
| A07 Identification/Auth Failures | Pass locally / enhancement open: server-generated magic links, hashed one-use state, profile re-checks, recent-auth e-mail change, direct-signup disable plan, and always-deny `beforeCreate` (`functions/src/index.ts:3-16`). Confirmation values use a fragment-plus-POST handoff, and `/auth/confirm` initializes no third-party analytics. Admin MFA remains a recommended post-staging enhancement. |
| A08 Software/Data Integrity      | Pass locally: lockfiles are present; transfer phases are checksummed, checkpointed, exact-target confirmed, non-empty-target protected, and Auth/logo verified. CI provenance/signing remains outside this migration's current scope.                                                                                                                                                                    |
| A09 Logging/Monitoring           | Pass for staging: runtime logs are structured and PII-free with bounded Firestore retention; enabled built-in Cloud Run 5xx and instance-cap policies route to the admin-selected managed e-mail channel. The trusted proxy overwrites inbound IDs with a UUID, returns it on every response, and propagates it through route logger children.                                                           |
| A10 SSRF                         | Pass locally: runtime never server-fetches Clinic website input; the only migration download uses the Supabase Storage client after exact source project/path validation, and the source base must be the exact HTTPS project origin (`scripts/firebase-migration/options.ts:69-82`).                                                                                                                    |

Open remediation priority:

1. Before production traffic: authenticate Brevo DKIM, provide the final domain/legal content, and
   run a content-level restore drill from a post-copy READY backup after approving a new exact
   temporary database.
2. Before every later rollout: recheck and remove the CLI-restored broad build-account role if it
   reappears; keep the temporary staging gate in place until the complete exit gate passes.
3. Ongoing: monitor the Firebase Admin/Functions dependency chain and enable MFA for administrator
   accounts when the chosen passwordless flow has been exercised in staging.

## Resume protocol

At the beginning of every future session:

1. Read `AGENTS.md`, `.codex/`, `README.md`, and this entire plan before planning or editing.
2. Run `git status --short` and preserve user-owned work, especially the quota changes listed above.
3. Read the installed Next.js guide relevant to the phase and current Firebase primary docs because
   both platforms can change.
4. Find the first unchecked item in the active phase; do not skip an exit gate.
5. Use TDD for code changes and update this file's status/check boxes/decision log in the same change.
6. Run focused tests while iterating, then `npm run typecheck`, `npm test`, `npm run lint`,
   `npm run format:check`, and `npm run build` at phase gates.
7. Never run a live import, deploy, traffic switch, Supabase disable, or deletion without the explicit
   approvals required by that phase.

## Primary references checked during discovery

- [Firebase App Hosting overview](https://firebase.google.com/docs/app-hosting)
- [App Hosting framework support](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
- [App Hosting configuration](https://firebase.google.com/docs/app-hosting/configure)
- [App Hosting costs](https://firebase.google.com/docs/app-hosting/costs)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Generate Auth e-mail action links](https://firebase.google.com/docs/auth/admin/email-action-links)
- [Firebase e-mail-link authentication](https://firebase.google.com/docs/auth/web/email-link-auth)
- [Import Firebase Auth users](https://firebase.google.com/docs/auth/admin/import-users)
- [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore pricing behavior](https://firebase.google.com/docs/firestore/pricing)
- [Firestore TTL](https://firebase.google.com/docs/firestore/ttl)
- [Firestore backups](https://firebase.google.com/docs/firestore/backups)
- [Firebase App Hosting logs and metrics](https://firebase.google.com/docs/app-hosting/logging)
- [Cloud Monitoring alerting](https://cloud.google.com/monitoring/alerts)
- [Google Cloud Observability pricing](https://cloud.google.com/products/observability/pricing)
- Installed Next.js 16.2 deployment, authentication, and Proxy guides under
  `node_modules/next/dist/docs/`.
