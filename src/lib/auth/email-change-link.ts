import 'server-only';

import { z } from 'zod';

import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { createFirestoreEmailStateStore } from '@/lib/firebase/email-state-store';
import { firebaseConfig } from '@/lib/firebase/env';
import { createSmtpMailer } from '@/lib/mail/smtp';

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
};

type EmailChangeMessage = { to: string; subject: string; text: string; html: string };

function defaultDependencies(): Dependencies {
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
  const code = z.string().min(10).max(2_000).safeParse(url.searchParams.get('oobCode'));
  if (!code.success || url.searchParams.get('mode') !== 'verifyAndChangeEmail') {
    throw new Error('Firebase returned an invalid email-change link');
  }
  return code.data;
}

function firstPartyLink(siteUrl: string, actionCode: string, state: string): string {
  return confirmationLink(siteUrl, { oobCode: actionCode, state, flow: 'email-change' });
}

function messageFor(email: string, link: string): EmailChangeMessage {
  const intro = 'Bestätige diese Adresse für deinen Admin-Zugang.';
  const notice = 'Nach der Änderung wird die bisherige Adresse aus Sicherheitsgründen informiert.';
  const text = `${intro}\n\n${link}\n\n${notice}\nDer Link ist 15 Minuten gültig.`;
  const htmlLink = link.replaceAll('&', '&amp;');
  const html = `<p>${intro}</p><p><a href="${htmlLink}">Neue E-Mail-Adresse bestätigen</a></p><p>${notice}</p><p>Der Link ist 15 Minuten gültig.</p>`;
  return { to: email, subject: 'Neue Admin-E-Mail-Adresse bestätigen', text, html };
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
    await dependencies.mailer.send(messageFor(request.newEmail, link));
  } catch (error) {
    await deleteEmailState(dependencies.stateStore, state);
    throw error;
  }
}
