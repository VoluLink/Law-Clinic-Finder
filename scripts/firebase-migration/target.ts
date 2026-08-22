import { createHash } from 'node:crypto';

import { Firestore } from '@google-cloud/firestore';
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserImportRecord } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';

import type { MigrationOptions } from './options';
import type {
  MigrationBundle,
  MigrationDocument,
  MigrationPhase,
  PreparedAuthUser,
} from './prepare';
import { checksumRecords } from './transforms';

const WRITE_BATCH_SIZE = 400;
const READ_BATCH_SIZE = 100;
const AUTH_BATCH_SIZE = 1_000;
const MAX_AUTH_USERS = 10_000;
const MIGRATED_LOGO_PATH = 'branding/logo-00000000-0000-4000-8000-000000000001.png';
const MANAGED_COLLECTIONS = [
  'adminMetrics',
  'adminState',
  'branding',
  'claimLimits',
  'clinicContacts',
  'clinicEvents',
  'clinicMetrics',
  'clinics',
  'conversationTranscripts',
  'conversations',
  'emailOwners',
  'logs',
  'migrationRuns',
  'profiles',
  'retention',
  'settings',
  'uniqueClinicNames',
  'uniqueClinicOwners',
] as const;

const runSchema = z.object({
  sourceRef: z.string(),
  targetProject: z.string(),
  phases: z
    .record(
      z.string(),
      z.object({
        checksum: z.string(),
        count: z.number().int().nonnegative(),
        completed: z.boolean(),
      }),
    )
    .default({}),
});

type MigrationTarget = ReturnType<typeof createMigrationTarget>;

export async function applyMigration(
  options: MigrationOptions,
  bundle: MigrationBundle,
): Promise<void> {
  const target = createMigrationTarget(options);
  const run = await openMigrationRun(target, options);
  for (const phase of bundle.phases) {
    if (phase.name === 'identities') await importAuthUsers(target, bundle.authUsers);
    if (completedPhase(run, phase) && !options.reconcile) continue;
    if (phase.name === 'configuration' && bundle.logo) await uploadLogo(target, bundle.logo);
    await writeDocuments(target, phase.documents);
    await verifyPhase(target, phase);
    if (phase.name === 'configuration' && bundle.logo) await verifyLogo(target, bundle.logo);
    await saveCheckpoint(target, options.runId, phase);
  }
  await verifyAuthUsers(target, bundle.authUsers);
  if (bundle.logo) await verifyLogo(target, bundle.logo);
  await target.database
    .collection('migrationRuns')
    .doc(options.runId)
    .set({ status: 'complete', completedAt: new Date(), updatedAt: new Date() }, { merge: true });
}

export async function verifyMigration(
  options: MigrationOptions,
  bundle: MigrationBundle,
): Promise<void> {
  const target = createMigrationTarget(options);
  for (const phase of bundle.phases) await verifyPhase(target, phase);
  await verifyAuthUsers(target, bundle.authUsers);
  if (bundle.logo) await verifyLogo(target, bundle.logo);
}

function createMigrationTarget(options: MigrationOptions) {
  const name = `firebase-copy-${options.runId}`;
  const app = getApps().some((candidate) => candidate.name === name)
    ? getApp(name)
    : initializeApp(
        {
          credential: applicationDefault(),
          projectId: options.targetProject,
          storageBucket: options.storageBucket,
        },
        name,
      );
  const database = new Firestore({
    projectId: options.targetProject,
    databaseId: options.databaseId,
  });
  return { database, auth: getAuth(app), bucket: getStorage(app).bucket() };
}

async function openMigrationRun(target: MigrationTarget, options: MigrationOptions) {
  const reference = target.database.collection('migrationRuns').doc(options.runId);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    if (options.reconcile) throw new Error('Cannot reconcile without a matching migration run');
    await assertTargetEmpty(target);
    await reference.create({
      sourceRef: options.sourceRef,
      targetProject: options.targetProject,
      status: 'running',
      phases: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return runSchema.parse({
      ...snapshot.data(),
      sourceRef: options.sourceRef,
      targetProject: options.targetProject,
    });
  }
  const run = runSchema.parse(snapshot.data());
  if (run.sourceRef !== options.sourceRef || run.targetProject !== options.targetProject) {
    throw new Error('Migration run source or target does not match');
  }
  return run;
}

async function assertTargetEmpty(target: MigrationTarget): Promise<void> {
  const [collections, users] = await Promise.all([
    Promise.all(MANAGED_COLLECTIONS.map((name) => target.database.collection(name).limit(1).get())),
    target.auth.listUsers(1),
  ]);
  const nonEmpty = collections.findIndex((snapshot) => !snapshot.empty);
  if (nonEmpty >= 0 || users.users.length > 0) {
    throw new Error('Target Firebase project is not empty and has no matching migration run');
  }
}

function completedPhase(run: z.infer<typeof runSchema>, phase: MigrationPhase): boolean {
  const checkpoint = run.phases[phase.name];
  if (!checkpoint) return false;
  if (checkpoint.checksum !== phase.checksum || checkpoint.count !== phase.documents.length) {
    throw new Error(`Source changed after phase ${phase.name} completed`);
  }
  return checkpoint.completed;
}

async function writeDocuments(
  target: MigrationTarget,
  documents: MigrationDocument[],
): Promise<void> {
  for (let offset = 0; offset < documents.length; offset += WRITE_BATCH_SIZE) {
    const batch = target.database.batch();
    for (const document of documents.slice(offset, offset + WRITE_BATCH_SIZE)) {
      batch.set(target.database.doc(document.path), document.data);
    }
    await batch.commit();
  }
}

async function saveCheckpoint(
  target: MigrationTarget,
  runId: string,
  phase: MigrationPhase,
): Promise<void> {
  await target.database
    .collection('migrationRuns')
    .doc(runId)
    .set(
      {
        phases: {
          [phase.name]: {
            checksum: phase.checksum,
            count: phase.documents.length,
            completed: true,
            completedAt: new Date(),
          },
        },
        updatedAt: new Date(),
      },
      { merge: true },
    );
}

async function verifyPhase(target: MigrationTarget, phase: MigrationPhase): Promise<void> {
  const records: MigrationDocument[] = [];
  for (let offset = 0; offset < phase.documents.length; offset += READ_BATCH_SIZE) {
    const expected = phase.documents.slice(offset, offset + READ_BATCH_SIZE);
    const snapshots = await target.database.getAll(
      ...expected.map((document) => target.database.doc(document.path)),
    );
    for (const snapshot of snapshots) {
      if (!snapshot.exists) throw new Error(`Missing target document: ${snapshot.ref.path}`);
      records.push({ path: snapshot.ref.path, data: snapshot.data()! });
    }
  }
  if (checksumRecords(records) !== phase.documentChecksum) {
    throw new Error(`Target checksum mismatch for phase ${phase.name}`);
  }
}

async function importAuthUsers(
  target: MigrationTarget,
  sourceUsers: PreparedAuthUser[],
): Promise<void> {
  const existing = await listTargetUsers(target);
  assertCompatibleUsers(existing, sourceUsers);
  const existingIds = new Set(existing.map((user) => user.uid));
  const missing = sourceUsers.filter((user) => !existingIds.has(user.uid));
  for (let offset = 0; offset < missing.length; offset += AUTH_BATCH_SIZE) {
    const records = missing.slice(offset, offset + AUTH_BATCH_SIZE).map(authImportRecord);
    const result = await target.auth.importUsers(records);
    if (result.failureCount > 0) throw new Error('Firebase Auth import failed');
  }
  await Promise.all(
    sourceUsers.map(async (user) => {
      await target.auth.updateUser(user.uid, {
        emailVerified: user.emailVerified,
        disabled: user.disabled,
      });
      await target.auth.setCustomUserClaims(user.uid, user.customClaims ?? null);
    }),
  );
}

function authImportRecord(user: PreparedAuthUser): UserImportRecord {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    customClaims: user.customClaims,
  };
}

async function listTargetUsers(target: MigrationTarget) {
  const users = [];
  let pageToken: string | undefined;
  do {
    const result = await target.auth.listUsers(AUTH_BATCH_SIZE, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
    if (users.length > MAX_AUTH_USERS) throw new Error('Target Auth exceeds safety limit');
  } while (pageToken);
  return users;
}

function assertCompatibleUsers(
  targetUsers: Awaited<ReturnType<typeof listTargetUsers>>,
  sourceUsers: PreparedAuthUser[],
): void {
  const sourceById = new Map(sourceUsers.map((user) => [user.uid, user]));
  const sourceByEmail = new Map(sourceUsers.map((user) => [user.email, user]));
  for (const target of targetUsers) {
    const source = sourceById.get(target.uid);
    const targetEmail = target.email?.toLowerCase();
    const claimsMatch = source
      ? checksumRecords([source.customClaims ?? {}]) === checksumRecords([target.customClaims])
      : false;
    if (
      !source ||
      source.email !== targetEmail ||
      source.emailVerified !== target.emailVerified ||
      source.disabled !== target.disabled ||
      !claimsMatch ||
      sourceByEmail.get(targetEmail ?? '')?.uid !== target.uid
    ) {
      throw new Error('Target Auth contains an identity that does not match the source');
    }
  }
}

async function verifyAuthUsers(
  target: MigrationTarget,
  sourceUsers: PreparedAuthUser[],
): Promise<void> {
  const targetUsers = await listTargetUsers(target);
  assertCompatibleUsers(targetUsers, sourceUsers);
  if (targetUsers.length !== sourceUsers.length)
    throw new Error('Firebase Auth user count mismatch');
}

async function uploadLogo(target: MigrationTarget, logo: Buffer): Promise<void> {
  await target.bucket.file(MIGRATED_LOGO_PATH).save(logo, {
    resumable: false,
    contentType: 'image/png',
    metadata: { cacheControl: 'public,max-age=31536000,immutable' },
  });
}

async function verifyLogo(target: MigrationTarget, expected: Buffer): Promise<void> {
  const [stored] = await target.bucket.file(MIGRATED_LOGO_PATH).download();
  if (sha256(stored) !== sha256(expected))
    throw new Error('Target branding logo checksum mismatch');
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
