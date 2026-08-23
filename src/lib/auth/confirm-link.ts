import 'server-only';

import {
  completeEmailSignIn,
  type EmailSignInDependencies,
} from '@/lib/auth/complete-email-sign-in';
import {
  completeEmailChange,
  type EmailChangeCompletionDependencies,
} from '@/lib/auth/email-change';
import { consumeEmailState, lookupEmailState } from '@/lib/auth/email-state';
import { applyEmailChangeCode, exchangeEmailLink } from '@/lib/auth/identity-toolkit';
import { activateFirstAccess } from '@/lib/firebase/activate-access';
import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { createFirestoreEmailStateStore } from '@/lib/firebase/email-state-store';
import { finalizeEmailChange, readFirebaseAuthEmail } from '@/lib/firebase/email-change-store';
import { readProfile } from '@/lib/firebase/profile-repository';
import { clearFirebaseSession, createSessionCookie } from '@/lib/firebase/session';

import {
  confirmationDestinationSchema,
  type ConfirmationDestination,
  type ConfirmationPayload,
} from './confirmation-payload';

type SignInResult = Awaited<ReturnType<typeof completeEmailSignIn>>;
type EmailChangeResult = Awaited<ReturnType<typeof completeEmailChange>>;

export type ConfirmationDependencies = {
  signIn: (state: string, actionCode: string) => Promise<SignInResult>;
  changeEmail: (state: string, actionCode: string) => Promise<EmailChangeResult>;
  clearSession: () => Promise<void>;
};

export type ConfirmationResult = {
  outcome: 'succeeded' | 'rejected' | 'failed';
  destination: ConfirmationDestination;
  reason?: string;
};

function signInDependencies(): EmailSignInDependencies {
  const stateStore = createFirestoreEmailStateStore();
  return {
    consumeState: (state, code) => consumeEmailState(stateStore, state, code),
    exchange: exchangeEmailLink,
    readProfile,
    activateFirstAccess,
    createSession: createSessionCookie,
  };
}

function emailChangeDependencies(): EmailChangeCompletionDependencies {
  const stateStore = createFirestoreEmailStateStore();
  return {
    lookup: (state, code) => lookupEmailState(stateStore, state, code),
    consume: (state, code) => consumeEmailState(stateStore, state, code),
    readAuthEmail: readFirebaseAuthEmail,
    applyActionCode: applyEmailChangeCode,
    finalize: finalizeEmailChange,
    revokeSessions: (userId) => firebaseAdminAuth().revokeRefreshTokens(userId),
  };
}

function defaultDependencies(): ConfirmationDependencies {
  return {
    signIn: (state, code) => completeEmailSignIn(state, code, signInDependencies()),
    changeEmail: (state, code) => completeEmailChange(state, code, emailChangeDependencies()),
    clearSession: clearFirebaseSession,
  };
}

async function confirmSignIn(
  payload: ConfirmationPayload,
  dependencies: ConfirmationDependencies,
): Promise<ConfirmationResult> {
  const result = await dependencies.signIn(payload.state, payload.oobCode);
  if (!result.ok) {
    const destination = result.reason === 'no_access' ? '/login?error=no_access' : '/login?error=1';
    return { outcome: 'rejected', destination, reason: result.reason };
  }
  return {
    outcome: 'succeeded',
    destination: confirmationDestinationSchema.parse(result.destination),
  };
}

async function confirmEmailChange(
  payload: ConfirmationPayload,
  dependencies: ConfirmationDependencies,
): Promise<ConfirmationResult> {
  const result = await dependencies.changeEmail(payload.state, payload.oobCode);
  if (!result.ok) return { outcome: 'rejected', destination: '/login?error=1' };
  await dependencies.clearSession();
  return { outcome: 'succeeded', destination: '/login?email_changed=1' };
}

export async function confirmAuthPayload(
  payload: ConfirmationPayload,
  dependencies: ConfirmationDependencies = defaultDependencies(),
): Promise<ConfirmationResult> {
  try {
    return payload.flow === 'email-change'
      ? await confirmEmailChange(payload, dependencies)
      : await confirmSignIn(payload, dependencies);
  } catch (error) {
    return {
      outcome: 'failed',
      destination: '/login?error=1',
      reason: error instanceof Error ? error.name : 'unknown',
    };
  }
}
