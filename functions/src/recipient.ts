import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const userIdSchema = z.string().trim().min(1).max(128);
const profileSchema = z
  .object({ role: z.literal('admin'), accessStatus: z.literal('active') })
  .passthrough();
const emailSchema = z.email().transform((email) => email.toLowerCase());

export type RecipientDependencies = {
  readProfile: (userId: string) => Promise<unknown>;
  readAuthEmail: (userId: string) => Promise<string | null>;
};

const app = getApps().length > 0 ? getApp() : initializeApp();

async function readProfile(userId: string): Promise<unknown> {
  const snapshot = await getFirestore(app, 'primary-eu').collection('profiles').doc(userId).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function readAuthEmail(userId: string): Promise<string | null> {
  return (await getAuth(app).getUser(userId)).email ?? null;
}

export const firebaseRecipientDependencies: RecipientDependencies = {
  readProfile,
  readAuthEmail,
};

export async function resolveActiveAdminEmail(
  userIdInput: string,
  dependencies: RecipientDependencies,
): Promise<string | null> {
  const userId = userIdSchema.parse(userIdInput);
  if (!profileSchema.safeParse(await dependencies.readProfile(userId)).success) return null;
  const email = await dependencies.readAuthEmail(userId);
  return email ? emailSchema.parse(email) : null;
}
