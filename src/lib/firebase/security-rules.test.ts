// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

const PROJECT_ID = 'demo-law-clinic-finder';
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`;
const emulatorsAvailable = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);

async function rulesSource(fileName: string) {
  return readFile(join(process.cwd(), fileName), 'utf8');
}

describe.skipIf(!emulatorsAvailable)('Firebase client security rules', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: await rulesSource('firestore.rules') },
      storage: { rules: await rulesSource('storage.rules') },
    });
  });

  afterEach(async () => {
    await Promise.all([environment.clearFirestore(), environment.clearStorage()]);
  });

  afterAll(async () => environment.cleanup());

  it('denies unauthenticated Firestore reads', async () => {
    const firestore = environment.unauthenticatedContext().firestore();
    await assertFails(firestore.doc('clinics/example').get());
  });

  it('denies authenticated Firestore reads', async () => {
    const firestore = environment.authenticatedContext('user-id').firestore();
    await assertFails(firestore.doc('profiles/user-id').get());
  });

  it('denies authenticated Firestore writes', async () => {
    const firestore = environment.authenticatedContext('user-id').firestore();
    await assertFails(firestore.doc('profiles/user-id').set({ role: 'admin' }));
  });

  it('allows public reads of server-written branding objects', async () => {
    await seedStorageObject('branding/logo.png');
    const storage = environment.unauthenticatedContext().storage(BUCKET_URL);
    await assertSucceeds(storage.ref('branding/logo.png').getMetadata());
  });

  it('denies public reads outside the branding prefix', async () => {
    await seedStorageObject('private/secret.txt');
    const storage = environment.unauthenticatedContext().storage(BUCKET_URL);
    await assertFails(storage.ref('private/secret.txt').getMetadata());
  });

  it('denies authenticated client uploads', async () => {
    const storage = environment.authenticatedContext('admin-id').storage(BUCKET_URL);
    const upload = Promise.resolve(storage.ref('branding/logo.png').putString('untrusted'));
    await assertFails(upload);
  });

  async function seedStorageObject(path: string) {
    await environment.withSecurityRulesDisabled(async (context) => {
      await context.storage(BUCKET_URL).ref(path).putString('fixture');
    });
  }
});
