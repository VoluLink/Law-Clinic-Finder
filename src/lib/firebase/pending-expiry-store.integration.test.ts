// @vitest-environment node

import { randomUUID } from 'node:crypto';

import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { firebaseAdminApp, firebaseAdminAuth, firebaseFirestore } from './admin';
import { clinicNameReservationId } from './clinic-repository';
import { emailReservationId } from './identity-reservations';
import {
  emailReservationIsLive,
  expirePendingApplication,
  releaseExpiredHolder,
  sweepDueApplications,
} from './pending-expiry-store';

const hasEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST,
);

const NOW = new Date('2026-08-26T12:00:00.000Z');
const OVERDUE = new Date('2026-08-18T12:00:00.000Z');
const NOT_DUE = new Date('2026-09-02T12:00:00.000Z');

type Seeded = {
  clinicId: string;
  userId: string;
  email: string;
  name: string;
};

type SeedOptions = {
  approvalStatus?: 'pending' | 'approved';
  accessStatus?: 'pending' | 'active';
  expiresAt?: Date | null;
  emailVerified?: boolean;
};

/** Builds the exact document set a self-registration or claim leaves behind. */
async function seedApplication(options: SeedOptions = {}): Promise<Seeded> {
  const database = firebaseFirestore();
  const clinicId = randomUUID();
  const name = `Expiry Clinic ${clinicId}`;
  const email = `applicant-${clinicId}@example.org`;
  const user = await firebaseAdminAuth().createUser({
    email,
    emailVerified: options.emailVerified ?? false,
  });
  const timestamp = Timestamp.fromDate(NOW);
  const expiresAt = options.expiresAt === null ? null : (options.expiresAt ?? OVERDUE);
  await Promise.all([
    database
      .collection('clinics')
      .doc(clinicId)
      .set({
        name,
        description: 'Beratung für alle',
        region: 'Berlin',
        website: 'https://clinic.example.org',
        legalAreas: 'Mietrecht',
        targetClients: 'Alle Ratsuchenden',
        languages: 'Deutsch',
        requirements: null,
        advisesClients: true,
        isPublished: false,
        approvalStatus: options.approvalStatus ?? 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    database
      .collection('uniqueClinicNames')
      .doc(clinicNameReservationId(name))
      .set({ clinicId, name, updatedAt: timestamp }),
    database.collection('clinicContacts').doc(clinicId).set({ contactEmail: email }),
    database
      .collection('uniqueClinicOwners')
      .doc(clinicId)
      .set({ userId: user.uid, updatedAt: timestamp }),
    database
      .collection('emailOwners')
      .doc(emailReservationId(email))
      .set({ userId: user.uid, role: 'clinic', updatedAt: timestamp }),
    database
      .collection('profiles')
      .doc(user.uid)
      .set({
        role: 'clinic',
        clinicId,
        accessStatus: options.accessStatus ?? 'pending',
        activatedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: expiresAt === null ? null : Timestamp.fromDate(expiresAt),
      }),
  ]);
  return { clinicId, userId: user.uid, email, name };
}

async function exists(collection: string, id: string): Promise<boolean> {
  return (await firebaseFirestore().collection(collection).doc(id).get()).exists;
}

async function authUserExists(userId: string): Promise<boolean> {
  try {
    await firebaseAdminAuth().getUser(userId);
    return true;
  } catch {
    return false;
  }
}

async function reservationsOf(seeded: Seeded) {
  return {
    profile: await exists('profiles', seeded.userId),
    owner: await exists('uniqueClinicOwners', seeded.clinicId),
    email: await exists('emailOwners', emailReservationId(seeded.email)),
    name: await exists('uniqueClinicNames', clinicNameReservationId(seeded.name)),
    clinic: await exists('clinics', seeded.clinicId),
    contact: await exists('clinicContacts', seeded.clinicId),
    identity: await authUserExists(seeded.userId),
  };
}

describe.skipIf(!hasEmulators)('pending application expiry', () => {
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

  it('releases every reservation an unanswered self-registration held', async () => {
    const seeded = await seedApplication();

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('expired');
    expect(await reservationsOf(seeded)).toEqual({
      profile: false,
      owner: false,
      email: false,
      name: false,
      clinic: false,
      contact: false,
      identity: false,
    });
  }, 20_000);

  it('keeps the live directory entry when the expired application only claimed it', async () => {
    const seeded = await seedApplication({ approvalStatus: 'approved' });

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('expired');
    const after = await reservationsOf(seeded);
    expect(after.clinic).toBe(true);
    expect(after.name).toBe(true);
    expect(after.owner).toBe(false);
  }, 20_000);

  it('leaves an application alone once the address is confirmed', async () => {
    const seeded = await seedApplication({ emailVerified: true });

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('kept');
    expect((await reservationsOf(seeded)).identity).toBe(true);
  }, 20_000);

  it('leaves an application an admin already approved', async () => {
    const seeded = await seedApplication({ accessStatus: 'active' });

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('kept');
    expect((await reservationsOf(seeded)).profile).toBe(true);
  }, 20_000);

  it('leaves an application that is not due yet', async () => {
    const seeded = await seedApplication({ expiresAt: NOT_DUE });

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('kept');
    expect((await reservationsOf(seeded)).profile).toBe(true);
  }, 20_000);

  it('leaves a profile written before the lifecycle existed', async () => {
    const seeded = await seedApplication({ expiresAt: null });

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('kept');
    expect((await reservationsOf(seeded)).profile).toBe(true);
  }, 20_000);

  it('is idempotent when the same expiry is retried', async () => {
    const seeded = await seedApplication();

    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('expired');
    expect(await expirePendingApplication(seeded.userId, NOW)).toBe('missing');
  }, 20_000);

  it('expires at most one application per concurrent attempt', async () => {
    const seeded = await seedApplication();

    const outcomes = await Promise.all([
      expirePendingApplication(seeded.userId, NOW),
      expirePendingApplication(seeded.userId, NOW),
    ]);

    expect(outcomes.filter((outcome) => outcome === 'expired')).toHaveLength(1);
  }, 20_000);

  it('reports an e-mail reservation as free once its application expires', async () => {
    const seeded = await seedApplication();

    expect(await emailReservationIsLive(seeded.email, NOW)).toBe(false);
    expect(await exists('emailOwners', emailReservationId(seeded.email))).toBe(false);
  }, 20_000);

  it('still reports a confirmed applicant as holding their address', async () => {
    const seeded = await seedApplication({ emailVerified: true });

    expect(await emailReservationIsLive(seeded.email, NOW)).toBe(true);
  }, 20_000);

  it('releases the holder a claim would otherwise collide with', async () => {
    const seeded = await seedApplication({ approvalStatus: 'approved' });

    expect(await releaseExpiredHolder(seeded.clinicId, NOW)).toBe('expired');
  }, 20_000);

  it('sweeps a bounded batch of due applications', async () => {
    const seeded = await Promise.all([seedApplication(), seedApplication()]);

    expect(await sweepDueApplications(NOW)).toBeGreaterThanOrEqual(2);
    for (const application of seeded) {
      expect(await exists('profiles', application.userId)).toBe(false);
    }
  }, 30_000);
});
