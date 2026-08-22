// @vitest-environment node

import { randomUUID } from 'node:crypto';

import { deleteApp } from 'firebase-admin/app';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { EmailStateRecord } from '@/lib/auth/email-state';

import { ClinicNameConflictError } from './clinic-repository';
import { firebaseAdminApp } from './admin';
import { firebaseClinicClaimStore } from './clinic-claim-store';
import { firebaseClinicRegistrationStore } from './clinic-registration-store';
import { createFirestoreEmailStateStore } from './email-state-store';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const NOW = new Date('2026-08-16T12:00:00.000Z');

describe.skipIf(!hasEmulator)('Firestore transaction invariants', () => {
  beforeAll(() => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'law-clinic-finder');
    vi.stubEnv('FIREBASE_DATABASE_ID', 'primary-eu');
    vi.stubEnv('FIREBASE_STORAGE_BUCKET', 'law-clinic-finder.firebasestorage.app');
    vi.stubEnv('IDENTITY_PLATFORM_API_KEY', 'emulator-only-key');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  });

  afterAll(async () => {
    await deleteApp(firebaseAdminApp());
    vi.unstubAllEnvs();
  });

  it('allows only one concurrent consumption of an e-mail state', async () => {
    const store = createFirestoreEmailStateStore();
    const id = randomUUID().replaceAll('-', '').padEnd(64, '0');
    const codeHash = 'a'.repeat(64);
    const record: EmailStateRecord = {
      email: 'clinic@example.org',
      userId: 'user-1',
      purpose: 'login',
      codeHash,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    };
    await store.save(id, record);

    const results = await Promise.all([
      store.consume(id, codeHash, NOW),
      store.consume(id, codeHash, NOW),
    ]);

    expect(results.filter((result) => result !== null)).toHaveLength(1);
  }, 20_000);

  it('allows only two concurrent claim attempts inside the rolling window', async () => {
    const clinicId = randomUUID();
    const results = await Promise.all([
      firebaseClinicClaimStore.reserveAttempt(clinicId, NOW),
      firebaseClinicClaimStore.reserveAttempt(clinicId, NOW),
      firebaseClinicClaimStore.reserveAttempt(clinicId, NOW),
    ]);

    expect(results.filter((result) => result.allowed)).toHaveLength(2);
  });

  it('creates only one clinic for concurrent duplicate names', async () => {
    const submission = {
      name: `Concurrent Clinic ${randomUUID()}`,
      contact_email: 'clinic@example.org',
      website: 'https://clinic.example.org',
      region: 'Berlin',
      legal_areas: 'Mietrecht',
      target_clients: 'Alle Ratsuchenden',
      languages: 'Deutsch',
      description: null,
      requirements: null,
      advises_clients: true,
    };
    const results = await Promise.allSettled([
      firebaseClinicRegistrationStore.createPending(submission),
      firebaseClinicRegistrationStore.createPending(submission),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const conflicts = results.filter(
      (result) => result.status === 'rejected' && result.reason instanceof ClinicNameConflictError,
    );

    expect({ fulfilled: fulfilled.length, conflicts: conflicts.length }).toEqual({
      fulfilled: 1,
      conflicts: 1,
    });
  });
});
