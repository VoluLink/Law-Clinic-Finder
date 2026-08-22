import { mkdir, writeFile } from 'node:fs/promises';

import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { makeChatSettings } from '@/lib/settings.fixtures';

const environmentSchema = z.object({
  FIREBASE_AUTH_EMULATOR_HOST: z.string().regex(/^127\.0\.0\.1:\d{2,5}$/),
  FIREBASE_PROJECT_ID: z.literal('law-clinic-finder'),
  FIRESTORE_EMULATOR_HOST: z.string().regex(/^127\.0\.0\.1:\d{2,5}$/),
});

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const TEST_PASSWORD = 'emulator-only-password';
const ACCOUNTS = [
  { role: 'admin', uid: 'e2e-admin', email: 'admin@example.com', clinicId: null },
  {
    role: 'clinic',
    uid: 'e2e-clinic',
    email: 'startright@example.com',
    clinicId: CLINIC_ID,
  },
] as const;

type TestAccount = (typeof ACCOUNTS)[number];

export default async function globalSetup(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const app = initializeApp({ projectId: environment.FIREBASE_PROJECT_ID }, 'playwright-seed');
  const auth = getAuth(app);
  const database = getFirestore(app, 'primary-eu');
  const now = Timestamp.fromDate(new Date('2026-08-22T10:00:00.000Z'));
  await seedPublicData(database, now);
  for (const account of ACCOUNTS) {
    await seedIdentity(auth, database, account, now);
    await writeAuthState(auth, account, environment.FIREBASE_AUTH_EMULATOR_HOST);
  }
  await deleteApp(app);
}

async function seedPublicData(
  database: FirebaseFirestore.Firestore,
  now: Timestamp,
): Promise<void> {
  await Promise.all([
    database.doc(`clinics/${CLINIC_ID}`).set(clinicDocument(now)),
    database.doc(`clinicContacts/${CLINIC_ID}`).set({ contactEmail: 'startright@example.com' }),
    database.doc('settings/chat').set({ values: makeChatSettings(), updatedAt: now }),
    database.doc('branding/current').set(brandingDocument(now)),
  ]);
}

async function seedIdentity(
  auth: Auth,
  database: FirebaseFirestore.Firestore,
  account: TestAccount,
  now: Timestamp,
): Promise<void> {
  await auth.createUser({
    uid: account.uid,
    email: account.email,
    emailVerified: true,
    password: TEST_PASSWORD,
  });
  await auth.setCustomUserClaims(account.uid, {
    role: account.role,
    accessStatus: 'active',
    ...(account.clinicId ? { clinicId: account.clinicId } : {}),
  });
  await writeIdentityDocuments(database, account, now);
}

async function writeIdentityDocuments(
  database: FirebaseFirestore.Firestore,
  account: TestAccount,
  now: Timestamp,
): Promise<void> {
  const writes: Array<Promise<FirebaseFirestore.WriteResult>> = [
    database.doc(`profiles/${account.uid}`).set(profileDocument(account, now)),
    database.doc(`emailOwners/${account.email}`).set({
      userId: account.uid,
      role: account.role,
      updatedAt: now,
    }),
  ];
  const roleWrite =
    account.role === 'admin'
      ? database.doc('adminState/current').set({ count: 1, updatedAt: now })
      : database
          .doc(`uniqueClinicOwners/${CLINIC_ID}`)
          .set({ userId: account.uid, updatedAt: now });
  await Promise.all([...writes, roleWrite]);
}

function profileDocument(account: TestAccount, now: Timestamp) {
  return {
    role: account.role,
    clinicId: account.clinicId,
    accessStatus: 'active',
    activatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function writeAuthState(auth: Auth, account: TestAccount, emulatorHost: string) {
  const idToken = await signIn(account.email, emulatorHost);
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: 60 * 60 * 1_000 });
  const directory = 'e2e/.auth';
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/${account.role}.json`, JSON.stringify(storageState(sessionCookie)));
}

async function signIn(email: string, emulatorHost: string): Promise<string> {
  const baseUrl = `http://${emulatorHost}`;
  const endpoint = new URL(
    '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
    baseUrl,
  );
  endpoint.searchParams.set('key', 'emulator-api-key');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
  });
  const parsed = z.object({ idToken: z.string().min(1) }).safeParse(await response.json());
  if (!response.ok || !parsed.success) throw new Error('Auth Emulator sign-in failed');
  return parsed.data.idToken;
}

function storageState(sessionCookie: string) {
  return {
    cookies: [
      {
        name: '__session',
        value: sessionCookie,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
}

function clinicDocument(now: Timestamp) {
  return {
    name: 'Start Right e.V.',
    description: 'Studentische Rechtsberatung für den lokalen E2E-Test.',
    region: 'Berlin; Bundesweit',
    website: 'https://example.com',
    legalAreas: 'Mietrecht; Vertragsrecht',
    targetClients: 'Privatpersonen',
    languages: 'Deutsch; Englisch',
    requirements: null,
    advisesClients: true,
    isPublished: true,
    approvalStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  };
}

function brandingDocument(now: Timestamp) {
  return {
    wordmark: 'Law Clinics Deutschland',
    logoPath: null,
    colorPrimary: '#0d4b5b',
    colorBackground: '#faf2e7',
    colorAccent: '#f0e6d2',
    colorForeground: '#3a565e',
    font: 'Hanken Grotesk',
    updatedAt: now,
  };
}
