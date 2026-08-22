import 'server-only';

import { z } from 'zod';

import { firebaseAdminAuth, firebaseFirestore } from '@/lib/firebase/admin';
import { profileDocumentSchema } from '@/lib/firebase/documents';

import { sendSignInLink } from './email-link';

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .transform((email) => email.toLowerCase());

type LoginUser = { uid: string; email: string };

export type LoginLinkDependencies = {
  findUser: (email: string) => Promise<LoginUser | null>;
  readProfile: (userId: string) => Promise<unknown>;
  sendLink: typeof sendSignInLink;
};

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function findFirebaseUser(email: string): Promise<LoginUser | null> {
  try {
    const user = await firebaseAdminAuth().getUserByEmail(email);
    return user.email ? { uid: user.uid, email: user.email.toLowerCase() } : null;
  } catch (error) {
    if (errorCode(error) === 'auth/user-not-found') return null;
    throw error;
  }
}

async function readFirebaseProfile(userId: string): Promise<unknown> {
  const snapshot = await firebaseFirestore().collection('profiles').doc(userId).get();
  if (!snapshot.exists) return null;
  const parsed = profileDocumentSchema.safeParse(snapshot.data());
  return parsed.success ? parsed.data : null;
}

function defaultDependencies(): LoginLinkDependencies {
  return {
    findUser: findFirebaseUser,
    readProfile: readFirebaseProfile,
    sendLink: sendSignInLink,
  };
}

export async function requestLoginLink(
  emailInput: string,
  dependencies: LoginLinkDependencies = defaultDependencies(),
): Promise<{ status: 'sent' | 'not_found' }> {
  const email = emailSchema.parse(emailInput);
  const user = await dependencies.findUser(email);
  if (!user || !(await dependencies.readProfile(user.uid))) return { status: 'not_found' };
  await dependencies.sendLink({ email: user.email, userId: user.uid, purpose: 'login' });
  return { status: 'sent' };
}
