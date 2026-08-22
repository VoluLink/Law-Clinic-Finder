import 'server-only';

import { z } from 'zod';

import type { Branding } from '@/lib/branding/branding';
import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { createFirestoreEmailStateStore } from '@/lib/firebase/email-state-store';
import { firebaseConfig } from '@/lib/firebase/env';

import { authEmailBranding, deliverAuthEmail, lazyActiveMailer } from './email-link';
import { createEmailState, deleteEmailState, type EmailStateStore } from './email-state';
import { confirmationLink } from './confirmation-payload';

const inputSchema = z.object({
  userId: z.string().min(1).max(128),
  currentEmail: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  newEmail: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
});

type ActionCodeSettings = { url: string; handleCodeInApp: true };

type Dependencies = {
  auth: {
    generateVerifyAndChangeEmailLink(
      currentEmail: string,
      newEmail: string,
      settings: ActionCodeSettings,
    ): Promise<string>;
  };
  mailer: { send(message: EmailChangeMessage): Promise<void> };
  stateStore: EmailStateStore;
  siteUrl: string;
  createState: typeof createEmailState;
  branding: () => Promise<Branding>;
};

type EmailChangeMessage = { to: string; subject: string; text: string; html: string };

function defaultDependencies(): Dependencies {
  return {
    auth: firebaseAdminAuth(),
    mailer: lazyActiveMailer(),
    stateStore: createFirestoreEmailStateStore(),
    siteUrl: firebaseConfig().siteUrl,
    createState: createEmailState,
    branding: authEmailBranding,
  };
}

function actionCodeFrom(link: string): string {
  const url = new URL(link);
  const code = z.string().min(10).max(2_000).safeParse(url.searchParams.get('oobCode'));
  if (!code.success || url.searchParams.get('mode') !== 'verifyAndChangeEmail') {
    throw new Error('Firebase returned an invalid email-change link');
  }
  return code.data;
}

function firstPartyLink(siteUrl: string, actionCode: string, state: string): string {
  return confirmationLink(siteUrl, { oobCode: actionCode, state, flow: 'email-change' });
}

export async function sendEmailChangeLink(
  input: z.input<typeof inputSchema>,
  dependencies: Dependencies = defaultDependencies(),
): Promise<void> {
  const request = inputSchema.parse(input);
  const settings = { url: `${dependencies.siteUrl}/auth/confirm`, handleCodeInApp: true } as const;
  const generated = await dependencies.auth.generateVerifyAndChangeEmailLink(
    request.currentEmail,
    request.newEmail,
    settings,
  );
  const actionCode = actionCodeFrom(generated);
  const state = await dependencies.createState(dependencies.stateStore, {
    email: request.newEmail,
    userId: request.userId,
    purpose: 'email_change',
    actionCode,
  });
  const link = firstPartyLink(dependencies.siteUrl, actionCode, state);
  try {
    await deliverAuthEmail({
      mailer: dependencies.mailer,
      branding: dependencies.branding,
      siteUrl: dependencies.siteUrl,
      to: request.newEmail,
      link,
      purpose: 'email_change',
    });
  } catch (error) {
    await deleteEmailState(dependencies.stateStore, state);
    throw error;
  }
}
