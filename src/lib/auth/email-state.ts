import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

const STATE_TTL_MS = 15 * 60 * 1_000;
const stateSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const actionCodeSchema = z.string().min(10).max(2_000);

const inputSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  userId: z.string().min(1).max(128),
  purpose: z.enum(['login', 'invite', 'email_change']),
  actionCode: actionCodeSchema,
});

export type EmailStateRecord = {
  email: string;
  userId: string;
  purpose: 'login' | 'invite' | 'email_change';
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
};

export type EmailStateStore = {
  save(id: string, record: EmailStateRecord): Promise<void>;
  find(id: string): Promise<EmailStateRecord | null>;
  consume(id: string, codeHash: string, now: Date): Promise<EmailStateRecord | null>;
  delete(id: string): Promise<void>;
};

type StateDependencies = {
  randomBytes(size: number): Buffer;
  now(): Date;
};

const defaultDependencies: StateDependencies = { randomBytes, now: () => new Date() };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function createEmailState(
  store: EmailStateStore,
  input: z.input<typeof inputSchema>,
  dependencies: StateDependencies = defaultDependencies,
): Promise<string> {
  const parsed = inputSchema.parse(input);
  const state = dependencies.randomBytes(32).toString('base64url');
  const createdAt = dependencies.now();
  const expiresAt = new Date(createdAt.getTime() + STATE_TTL_MS);
  const { actionCode, ...record } = parsed;
  await store.save(sha256(state), {
    ...record,
    codeHash: sha256(actionCode),
    createdAt,
    expiresAt,
  });
  return state;
}

export async function lookupEmailState(
  store: EmailStateStore,
  state: string,
  actionCode: string,
  now = new Date(),
): Promise<EmailStateRecord | null> {
  if (!stateSchema.safeParse(state).success || !actionCodeSchema.safeParse(actionCode).success) {
    return null;
  }
  const record = await store.find(sha256(state));
  if (!record || record.expiresAt <= now) return null;
  return hashesMatch(record.codeHash, sha256(actionCode)) ? record : null;
}

export async function consumeEmailState(
  store: EmailStateStore,
  state: string,
  actionCode: string,
  now = new Date(),
): Promise<EmailStateRecord | null> {
  const valid = await lookupEmailState(store, state, actionCode, now);
  if (!valid) return null;
  return store.consume(sha256(state), sha256(actionCode), now);
}

export async function deleteEmailState(store: EmailStateStore, state: string): Promise<void> {
  if (stateSchema.safeParse(state).success) await store.delete(sha256(state));
}
