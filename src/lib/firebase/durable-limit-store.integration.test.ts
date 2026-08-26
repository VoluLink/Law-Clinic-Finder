// @vitest-environment node

import { randomUUID } from 'node:crypto';

import { deleteApp } from 'firebase-admin/app';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AbuseWindow } from '@/lib/security/abuse-window';

import { firebaseAdminApp, firebaseFirestore } from './admin';
import { consumeDurableLimit, consumeDurableLimits } from './durable-limit-store';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const NOW = new Date('2026-08-26T12:00:00.000Z');
const WINDOW: AbuseWindow = { maxRequests: 3, windowMs: 60 * 60 * 1_000 };

function subject(): string {
  return `applicant-${randomUUID()}@example.org`;
}

async function documentCount(): Promise<number> {
  return (await firebaseFirestore().collection('abuseLimits').count().get()).data().count;
}

describe.skipIf(!hasEmulator)('durable abuse limits', () => {
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

  it('allows exactly the configured number of attempts', async () => {
    const email = subject();
    const outcomes = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      outcomes.push((await consumeDurableLimit('login', email, WINDOW, NOW)).allowed);
    }
    expect(outcomes).toEqual([true, true, true, false]);
  }, 20_000);

  /* The whole point of moving the count out of process memory: two instances
     racing the last remaining attempt must not both win it. */
  it('lets only one of two concurrent attempts take the last slot', async () => {
    const email = subject();
    await consumeDurableLimit('login', email, WINDOW, NOW);
    await consumeDurableLimit('login', email, WINDOW, NOW);

    const raced = await Promise.all([
      consumeDurableLimit('login', email, WINDOW, NOW),
      consumeDurableLimit('login', email, WINDOW, NOW),
    ]);

    expect(raced.filter((decision) => decision.allowed)).toHaveLength(1);
  }, 20_000);

  it('counts the same address independently per scope', async () => {
    const email = subject();
    for (let attempt = 0; attempt < 3; attempt++) {
      await consumeDurableLimit('login', email, WINDOW, NOW);
    }

    expect((await consumeDurableLimit('login', email, WINDOW, NOW)).allowed).toBe(false);
    expect((await consumeDurableLimit('application', email, WINDOW, NOW)).allowed).toBe(true);
  }, 20_000);

  it('lets the address through again once the window has passed', async () => {
    const email = subject();
    for (let attempt = 0; attempt < 3; attempt++) {
      await consumeDurableLimit('login', email, WINDOW, NOW);
    }
    const later = new Date(NOW.getTime() + WINDOW.windowMs + 1_000);

    expect((await consumeDurableLimit('login', email, WINDOW, later)).allowed).toBe(true);
  }, 20_000);

  it('stores neither the address nor anything but timestamps', async () => {
    const email = subject();
    await consumeDurableLimit('login', email, WINDOW, NOW);

    const snapshot = await firebaseFirestore().collection('abuseLimits').get();
    const documents = snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
    const serialized = JSON.stringify(documents);
    expect(serialized).not.toContain(email);
    expect(Object.keys(documents[0].data).sort()).toEqual(['expiresAt', 'hits']);
  }, 20_000);

  it('writes nothing at all for a blocked attempt', async () => {
    const email = subject();
    for (let attempt = 0; attempt < 3; attempt++) {
      await consumeDurableLimit('login', email, WINDOW, NOW);
    }
    const before = await documentCount();

    await consumeDurableLimit('login', email, WINDOW, NOW);

    expect(await documentCount()).toBe(before);
  }, 20_000);

  it('stops at the first refused key rather than counting the rest', async () => {
    const blocked = subject();
    const untouched = subject();
    for (let attempt = 0; attempt < 3; attempt++) {
      await consumeDurableLimit('application', blocked, WINDOW, NOW);
    }

    const decision = await consumeDurableLimits(
      [
        { scope: 'application', subject: blocked, window: WINDOW },
        { scope: 'network', subject: untouched, window: WINDOW },
      ],
      NOW,
    );

    expect(decision.allowed).toBe(false);
    expect((await consumeDurableLimit('network', untouched, WINDOW, NOW)).allowed).toBe(true);
  }, 20_000);
});
