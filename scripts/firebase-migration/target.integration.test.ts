import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { MigrationOptions } from './options';
import type { MigrationBundle, MigrationDocument } from './prepare';
import { applyMigration, verifyMigration } from './target';
import { checksumRecords } from './transforms';

const hasEmulators = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST &&
  process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);

const options: MigrationOptions = {
  sourceUrl: 'https://abcdefghijklmnopqrst.supabase.co',
  sourceSecret: 'emulator-only',
  sourceRef: 'abcdefghijklmnopqrst',
  runId: 'emulator-copy',
  targetProject: 'law-clinic-finder',
  databaseId: 'primary-eu',
  storageBucket: 'law-clinic-finder.firebasestorage.app',
  apply: true,
  verify: false,
  reconcile: false,
  confirmTarget: 'law-clinic-finder',
  mode: 'apply',
};

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-08-16T10:00:00.000Z');
const logo = Buffer.from('emulator-normalized-logo');

function migrationBundle(): MigrationBundle {
  const documents: MigrationDocument[] = [
    {
      path: `profiles/${ADMIN_ID}`,
      data: {
        role: 'admin',
        clinicId: null,
        accessStatus: 'active',
        activatedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    { path: 'adminState/current', data: { count: 1, updatedAt: now } },
  ].sort((left, right) => left.path.localeCompare(right.path));
  const configuration: MigrationDocument[] = [
    { path: 'settings/chat', data: { values: { chat_enabled: false }, updatedAt: now } },
  ];
  return {
    phases: [
      {
        name: 'identities',
        documents,
        checksum: checksumRecords(documents),
        documentChecksum: checksumRecords(documents),
      },
      {
        name: 'configuration',
        documents: configuration,
        checksum: checksumRecords([
          ...configuration,
          { logoSha256: createHash('sha256').update(logo).digest('hex') },
        ]),
        documentChecksum: checksumRecords(configuration),
      },
    ],
    authUsers: [
      {
        uid: ADMIN_ID,
        email: 'admin@example.org',
        emailVerified: true,
        disabled: false,
        customClaims: { role: 'admin', accessStatus: 'active' },
      },
    ],
    logo,
  };
}

describe.skipIf(!hasEmulators)('Firebase migration target', () => {
  it('applies, verifies, and resumes the same copy idempotently', async () => {
    const bundle = migrationBundle();
    await applyMigration(options, bundle);
    await applyMigration(options, bundle);
    await expect(verifyMigration(options, bundle)).resolves.toBeUndefined();
  });

  it('reconciles drift only when explicitly requested', async () => {
    const bundle = migrationBundle();
    await applyMigration(options, bundle);
    const { Firestore } = await import('@google-cloud/firestore');
    const database = new Firestore({
      projectId: options.targetProject,
      databaseId: options.databaseId,
    });
    await database.doc('settings/chat').update({ updatedAt: new Date('2026-08-17T10:00:00.000Z') });
    await expect(verifyMigration(options, bundle)).rejects.toThrow(/checksum mismatch/i);
    await applyMigration({ ...options, reconcile: true }, bundle);
    await expect(verifyMigration(options, bundle)).resolves.toBeUndefined();
  });
});
