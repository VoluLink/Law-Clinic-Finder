# Firebase Agent Playbook

This is the operational handoff for agents changing or operating this project. Read `AGENTS.md`
and the root `README.md` first, then this file before touching Firebase, authentication, SMTP,
hosting, data, IAM, or secrets.

## Fixed targets

| Resource                     | Required target                                                   |
| ---------------------------- | ----------------------------------------------------------------- |
| Google/Firebase project      | `law-clinic-finder`                                               |
| App Hosting backend          | `web`                                                             |
| App Hosting region           | `europe-west4`                                                    |
| Firestore database           | `primary-eu` — never `(default)`                                  |
| Storage bucket               | `law-clinic-finder.firebasestorage.app`                           |
| App runtime identity         | `law-clinic-runtime@law-clinic-finder.iam.gserviceaccount.com`    |
| Monitoring function identity | `law-clinic-monitoring@law-clinic-finder.iam.gserviceaccount.com` |
| Node runtime                 | Node 22                                                           |
| Public source branch         | `main` after its checks pass                                      |

Fail closed if a command, environment variable, emulator, script, or console page points at a
different project, database, bucket, region, or identity. Never substitute `(default)` for
`primary-eu`.

## Start and resume safely

1. Run `git status --short --branch`; preserve unrelated or user-owned changes.
2. Read `README.md`, then `docs/firebase-migration-plan.md` for only the outstanding work.
3. Inspect the relevant implementation and its colocated tests before planning a change.
4. For Next.js work, read the matching installed guide in `node_modules/next/dist/docs/` first.
5. Confirm the active cloud target without reading secrets:

```bash
./node_modules/.bin/firebase use
"$HOME/google-cloud-sdk/bin/gcloud" config get-value project
./node_modules/.bin/firebase apphosting:backends:list --project law-clinic-finder
```

Expected: project `law-clinic-finder`, backend `web`, region `europe-west4`. Local ADC belongs in
`$HOME/.config/gcloud/`, outside the repository. Never add a service-account JSON file.

## Development workflow

- Work emulator-first. Normal application tests must not contact live Firebase.
- Follow red → green → refactor for behavior changes; validate every external input and Firestore
  document with Zod.
- Keep Firebase SDK/query types inside `src/lib/firebase/`. Domain code depends on small ports, not
  Firestore query syntax.
- Use `firebase-admin/firestore` consistently for the database, `Timestamp`, `FieldPath`, and
  `FieldValue`. Do not introduce a second runtime Firestore client.
- The browser never writes directly to Firestore or Storage. Every protected operation rechecks the
  Firebase session and current `profiles/{uid}` role server-side.
- `settings/chat` is the only source for admin-editable prompts. Add or change defaults through a
  versioned, idempotent data migration; never add a code fallback.
- Preserve the provider-neutral SMTP boundary. Runtime code consumes host, port, TLS behavior,
  login, password, sender address, and sender name; it must not call a Brevo-specific API.
- Keep functions small, use type-only imports, emit structured PII-free logs, and propagate the
  server-generated request ID.

Run the ordinary gates before every commit:

```bash
npm run typecheck
npm test
npm --prefix functions test
npm --prefix functions run build
npm run lint
npm run format:check
npm run build
npm audit --omit=dev --audit-level=high
npm --prefix functions audit --omit=dev --audit-level=high
```

Run the affected emulator suites for Firebase-sensitive changes:

```bash
npm run test:firebase
npm run test:rules
npm run test:migration
npm run test:e2e
```

The GitHub `CI` workflow repeats the non-live gates on pull requests and `main`. Actions are pinned
to immutable commit SHAs, permissions are read-only, duplicate runs are cancelled, and no Firebase
credential is stored in GitHub.

## Automatic App Hosting delivery

Use Firebase App Hosting's native GitHub integration, not a long-lived Firebase token or Google
service-account key in GitHub. The intended connection is repository
`hackerFlo/Law-Clinic-Finder`, root `/`, live branch `main`, with automatic rollouts enabled. Create
the connection through the Firebase/Google Cloud console with data residency enabled and grant the
GitHub App access to this repository only.

Recommended day-to-day flow:

```text
feature branch → pull request → CI succeeds → merge to main → App Hosting automatic rollout
```

App Hosting builds and rolls back revisions for the Next.js backend. It does **not** deploy every
other Firebase resource in this repository:

| Changed surface                                      | Delivery rule                                           |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/**`, `public/**`, Next/app runtime config       | Automatic App Hosting rollout after `main` updates      |
| `functions/**`                                       | Explicit reviewed Functions deployment                  |
| `firestore.rules`, `firestore.indexes.json`          | Explicit reviewed Firestore deployment                  |
| `storage.rules`                                      | Explicit reviewed Storage deployment                    |
| Identity Platform, secrets, IAM, backups, monitoring | Explicit cloud operation with exact target verification |
| `docs/**`, tests, local migration tooling            | Do not trigger an App Hosting rollout                   |

To reduce builds and cost, configure App Hosting rollout triggers to ignore documentation,
assistant-only files, tests, emulators, migration tooling, historical Supabase files, and
Functions-only changes. Never ignore `package.json`, lockfiles, `apphosting.yaml`, `firebase.json`,
`next.config.*`, `src/**`, or `public/**`.

After every automatic rollout, confirm the rollout is READY, serves from `law-clinic-runtime`, and
retains the staging gate until public cutover. Check that the default build identity did not regain
`roles/firebase.sdkAdminServiceAgent`; if it did, stop, review the exact binding, and remove only
that binding. Never remove the legitimate `developerconnect.readTokenAccessor`,
`firebaseapphosting.computeRunner`, or `storage.objectViewer` bindings.

## Explicit infrastructure deployments

Infrastructure changes need the user's authorization for that deployment and the exact target.
Prefer narrow deploys:

```bash
env -u DEBUG ./node_modules/.bin/firebase deploy \
  --only firestore --project law-clinic-finder --non-interactive

env -u DEBUG ./node_modules/.bin/firebase deploy \
  --only storage --project law-clinic-finder --non-interactive

env -u DEBUG ./node_modules/.bin/firebase deploy \
  --only functions:auth --project law-clinic-finder --non-interactive
```

Only use a manual App Hosting source rollout for recovery or when the GitHub connection is
unavailable:

```bash
env -u DEBUG ./node_modules/.bin/firebase deploy \
  --only apphosting --project law-clinic-finder --non-interactive
```

That CLI path has repeatedly restored a broad build-account role. Immediately inspect project IAM;
if the exact unwanted binding exists, remove only this member/role pair and verify it is absent:

```bash
GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
BUILD_MEMBER='serviceAccount:firebase-app-hosting-compute@law-clinic-finder.iam.gserviceaccount.com'

"$GCLOUD" projects get-iam-policy law-clinic-finder \
  --flatten='bindings[].members' \
  --filter="bindings.role:roles/firebase.sdkAdminServiceAgent AND bindings.members:$BUILD_MEMBER" \
  --format='table(bindings.role,bindings.members)'

"$GCLOUD" projects remove-iam-policy-binding law-clinic-finder \
  --member="$BUILD_MEMBER" \
  --role='roles/firebase.sdkAdminServiceAgent' \
  --quiet
```

Do not run the removal command when the read-only query is empty. After any rollout, verify the
staging/public access mode, security headers, runtime identity, new revision traffic, and error logs
without logging credentials, magic links, e-mail addresses, request bodies, or tokens.

## Secrets and configuration

- Secret values live only in regional Secret Manager or untracked `.env.local`; never print, copy
  into documentation, upload, or commit them.
- `apphosting.yaml` may contain non-secret values and secret **names**, never secret values.
- Grant secret access to `law-clinic-runtime` only. Build identities must not read application
  secrets unless App Hosting requires a narrowly documented build-time reference.
- Never replace the SMTP configuration with provider-specific code. A future admin UI must write a
  complete versioned secret atomically, display only set/unset state, require recent admin
  reauthentication, and record only redacted audit metadata.
- After environment changes, verify `.env` tracking/history as required by `AGENTS.md`.

## Data, Auth, and migration safety

- Supabase is an intact read-only source/rollback copy. Never delete, update, disable, or
  decommission it without separate explicit authorization.
- Migration scripts are dry-run first, target-pinned, idempotent, and copy-only. They must never
  export PII into the repository or delete unexpected Firebase documents.
- Never create, restore, or delete a Firestore database without exact approval of its full temporary
  database ID. `primary-eu` has deletion protection and is never a restore-drill target.
- Keep Identity Platform end-user signup and deletion disabled. `beforeAccountCreated` must remain
  deployed and deny direct client creation; only reviewed Admin SDK workflows may create accounts.
- Never seed or ship `admin@example.com`, `startright@example.com`, or other demo identities.
- Auth state stays in the bounded `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. Do not put ID
  or refresh tokens in browser storage.
- Firestore and Storage rules remain deny-by-default. Private clinic contacts, conversations, Auth
  state, and logs are server-only.

## Cost and privacy defaults

- Keep App Hosting at `minInstances: 0`, `maxInstances: 3`, concurrency 80, 1 CPU, and 512 MiB unless
  measurements justify a reviewed change.
- Keep the operational-alert function at zero minimum and one maximum instance. Prefer built-in
  Cloud Run metrics; do not add uptime polling or a custom log metric without a measured need.
- Preserve TTL and retention policies, write-time monthly aggregates, query limits, and the
  200-transcript cap. Avoid collection scans, per-request config reads, and high-cardinality logs.
- Logs must be structured, correlated, and free of PII, secrets, message content, and URL action
  codes. Clients receive generic infrastructure errors.
- Keep daily Firestore backups with seven-day retention. Perform a read-only content restore drill
  at least quarterly in an explicitly approved temporary database.

## Approval boundaries

Read-only inspection, emulator work, tests, and ordinary scoped code edits are safe. Obtain explicit
authorization before:

- pushing, opening a pull request, deploying, publishing, or changing live traffic;
- changing Identity Platform, IAM, secrets, billing, monitoring, backup policy, or API-key scope;
- applying a migration to live Firebase or reconciling live source-owned paths;
- creating or deleting any cloud database/resource;
- disabling or deleting Supabase data or services.

For public deployment, stop until the domain, authorized domains/action links, final Impressum and
Datenschutzerklärung, Brevo first-party DKIM, content-level restore drill, and staging-exit checks in
`docs/firebase-migration-plan.md` are complete.

## Rollback and incident response

1. Stop further rollouts and preserve logs without copying PII.
2. For an app regression, use App Hosting's instant rollback to the last known-good rollout.
3. For rules or Functions regressions, redeploy the last reviewed Git revision of only the affected
   resource; do not roll unrelated data or IAM backward.
4. For data damage, do not overwrite `primary-eu` impulsively. Restore the matching READY backup to
   a newly approved temporary database, verify read-only, then plan a scoped recovery.
5. Recheck staging protection, runtime identity, broad-role absence, Auth blocker, backups, alerts,
   and error logs before reopening traffic.

Official operational references:

- [Firebase App Hosting automatic rollouts](https://firebase.google.com/docs/app-hosting/rollouts)
- [Firebase App Hosting configuration](https://firebase.google.com/docs/app-hosting/configure)
- [Firebase App Hosting logs](https://firebase.google.com/docs/app-hosting/logging)
- [Firestore backups](https://firebase.google.com/docs/firestore/backups)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
