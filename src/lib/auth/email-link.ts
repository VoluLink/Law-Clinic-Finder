import 'server-only';

import { z } from 'zod';

import { DEFAULT_BRANDING, loadBranding, type Branding } from '@/lib/branding/branding';
import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';
import { createFirestoreEmailStateStore } from '@/lib/firebase/email-state-store';
import { firebaseConfig } from '@/lib/firebase/env';
import { logger } from '@/lib/logger';
import { activeMailer } from '@/lib/mail/active-config';
import { renderAuthEmail, type AuthEmailPurpose } from '@/lib/mail/auth-email';

import { createEmailState, deleteEmailState, type EmailStateStore } from './email-state';
import { confirmationLink } from './confirmation-payload';

const requestSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  userId: z.string().min(1).max(128),
  purpose: z.enum(['login', 'invite']),
});

type AuthLinkRequest = z.input<typeof requestSchema>;
type ActionCodeSettings = { url: string; handleCodeInApp: true };

type EmailLinkDependencies = {
  auth: {
    generateSignInWithEmailLink(email: string, settings: ActionCodeSettings): Promise<string>;
  };
  mailer: { send(message: EmailMessage): Promise<void> };
  stateStore: EmailStateStore;
  siteUrl: string;
  createState: typeof createEmailState;
  branding: () => Promise<Branding>;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Shared by every transactional auth mail: a branding outage must not stop delivery. */
export async function authEmailBranding(): Promise<Branding> {
  try {
    return await loadBranding(firebaseBrandingRepository);
  } catch (error) {
    logger.warn('auth e-mail branding unavailable', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return DEFAULT_BRANDING;
  }
}

/** Resolved per message so an activated SMTP configuration takes effect without a redeploy. */
export function lazyActiveMailer(): { send(message: EmailMessage): Promise<void> } {
  return { send: async (message) => (await activeMailer()).send(message) };
}

type AuthEmailDelivery = {
  mailer: { send(message: EmailMessage): Promise<void> };
  branding: () => Promise<Branding>;
  siteUrl: string;
  to: string;
  link: string;
  purpose: AuthEmailPurpose;
};

/** Single rendering and delivery path for every transactional auth mail. */
export async function deliverAuthEmail(delivery: AuthEmailDelivery): Promise<void> {
  const branding = await delivery.branding();
  const { purpose, link, siteUrl } = delivery;
  const message = renderAuthEmail({ purpose, link, branding, siteUrl });
  await delivery.mailer.send({ to: delivery.to, ...message });
}

function defaultDependencies(): EmailLinkDependencies {
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
  const parsed = z.string().min(10).max(2_000).safeParse(url.searchParams.get('oobCode'));
  if (!parsed.success || url.searchParams.get('mode') !== 'signIn') {
    throw new Error('Firebase returned an invalid sign-in link');
  }
  return parsed.data;
}

function firstPartyLink(siteUrl: string, actionCode: string, state: string): string {
  return confirmationLink(siteUrl, { oobCode: actionCode, state });
}

export async function sendSignInLink(
  input: AuthLinkRequest,
  dependencies: EmailLinkDependencies = defaultDependencies(),
): Promise<void> {
  const request = requestSchema.parse(input);
  const settings = { url: `${dependencies.siteUrl}/auth/confirm`, handleCodeInApp: true } as const;
  const generated = await dependencies.auth.generateSignInWithEmailLink(request.email, settings);
  const actionCode = actionCodeFrom(generated);
  const state = await dependencies.createState(dependencies.stateStore, { ...request, actionCode });
  const link = firstPartyLink(dependencies.siteUrl, actionCode, state);
  try {
    await deliverAuthEmail({
      mailer: dependencies.mailer,
      branding: dependencies.branding,
      siteUrl: dependencies.siteUrl,
      to: request.email,
      link,
      purpose: request.purpose,
    });
  } catch (error) {
    await deleteEmailState(dependencies.stateStore, state);
    throw error;
  }
}
