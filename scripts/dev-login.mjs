// Emulator-only cleanup for the two reserved development identities.
// Usage: npm run dev:login:teardown
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { Firestore } from '@google-cloud/firestore';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const DEV_EMAIL_DOMAIN = '@example.com';
const DEV_EMAILS = [`admin${DEV_EMAIL_DOMAIN}`, `startright${DEV_EMAIL_DOMAIN}`];
const LOOPBACK = /^(?:127\.0\.0\.1|localhost):\d{2,5}$/;

export function assertDevEmail(email) {
  if (!email.toLowerCase().endsWith(DEV_EMAIL_DOMAIN)) {
    throw new Error(`Refusing "${email}": expected the reserved ${DEV_EMAIL_DOMAIN} domain`);
  }
}

export function assertEmulators(env = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('Dev teardown is disabled in production');
  if (!LOOPBACK.test(env.FIREBASE_AUTH_EMULATOR_HOST ?? '')) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST must point to loopback');
  }
  if (!LOOPBACK.test(env.FIRESTORE_EMULATOR_HOST ?? '')) {
    throw new Error('FIRESTORE_EMULATOR_HOST must point to loopback');
  }
}

function firebaseServices() {
  assertEmulators();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || 'demo-law-clinic-finder';
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || 'primary-eu';
  const app = getApps().length > 0 ? getApp() : initializeApp({ projectId });
  return { auth: getAuth(app), database: new Firestore({ projectId, databaseId }) };
}

async function listDevUsers(auth) {
  const wanted = new Set(DEV_EMAILS);
  const result = await auth.listUsers(1_000);
  return result.users.filter((user) => wanted.has(user.email?.toLowerCase() ?? ''));
}

async function unlinkProfile(database, user) {
  const profileReference = database.doc(`profiles/${user.uid}`);
  const stateReference = database.doc('adminState/current');
  const email = user.email?.toLowerCase() ?? '';
  const emailOwner = database.doc(`emailOwners/${emailReservationId(email)}`);
  await database.runTransaction(async (transaction) => {
    const [profile, state] = await Promise.all([
      transaction.get(profileReference),
      transaction.get(stateReference),
    ]);
    transaction.delete(profileReference);
    transaction.delete(emailOwner);
    const clinicId = profile.data()?.clinicId;
    if (typeof clinicId === 'string') {
      transaction.delete(database.doc(`uniqueClinicOwners/${clinicId}`));
    }
    if (profile.data()?.role === 'admin' && state.exists) {
      const count = Number(state.data()?.count);
      if (Number.isInteger(count) && count > 1)
        transaction.update(stateReference, { count: count - 1 });
      else transaction.delete(stateReference);
    }
  });
}

function emailReservationId(email) {
  return createHash('sha256').update(email).digest('hex');
}

async function teardown() {
  const { auth, database } = firebaseServices();
  const users = await listDevUsers(auth);
  for (const user of users) {
    assertDevEmail(user.email ?? '');
    await unlinkProfile(database, user);
    await auth.deleteUser(user.uid);
    process.stdout.write(`deleted ${user.email} from the Firebase emulators\n`);
  }
  process.stdout.write(`${users.length} emulator dev account(s) removed.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--teardown')) {
    process.stderr.write('Usage: npm run dev:login:teardown\n');
    process.exitCode = 1;
  } else {
    await teardown();
  }
}
