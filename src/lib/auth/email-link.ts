import 'server-only';

import { z } from 'zod';

import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { createFirestoreEmailStateStore } from '@/lib/firebase/email-state-store';
import { firebaseConfig } from '@/lib/firebase/env';
import { createSmtpMailer } from '@/lib/mail/smtp';

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
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function defaultDependencies(): EmailLinkDependencies {
  return {
    auth: firebaseAdminAuth(),
    mailer: createSmtpMailer(),
    stateStore: createFirestoreEmailStateStore(),
    siteUrl: firebaseConfig().siteUrl,
    createState: createEmailState,
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

function messageFor(email: string, link: string, purpose: 'login' | 'invite'): EmailMessage {
  const invitation = purpose === 'invite';
  const subject = invitation ? 'Einladung zum Law Clinic Finder' : 'Dein Anmeldelink';
  const intro = invitation
    ? 'Du wurdest zum Law Clinic Finder eingeladen.'
    : 'Mit diesem Link meldest du dich beim Law Clinic Finder an.';
  const text = `${intro}\n\n${link}\n\nDer Link ist 15 Minuten gültig und nur einmal verwendbar.`;
  const html = `<p>${intro}</p><p><a href="${link.replaceAll('&', '&amp;')}">Sicher anmelden</a></p><p>Der Link ist 15 Minuten gültig und nur einmal verwendbar.</p>`;
  return { to: email, subject, text, html };
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
    await dependencies.mailer.send(messageFor(request.email, link, request.purpose));
  } catch (error) {
    await deleteEmailState(dependencies.stateStore, state);
    throw error;
  }
}
