import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BRANDING } from '@/lib/branding/branding';

import type { EmailStateStore } from './email-state';
import { sendSignInLink } from './email-link';

function stateStore(): EmailStateStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    consume: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

const generatedLink =
  'https://law-clinic-finder.firebaseapp.com/__/auth/action?mode=signIn&oobCode=generated-action-code&apiKey=public-key';
const firstPartyState = 'A'.repeat(43);

describe(sendSignInLink.name, () => {
  it('sends a first-party link through the configured mailer', async () => {
    const auth = { generateSignInWithEmailLink: vi.fn().mockResolvedValue(generatedLink) };
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };

    await sendSignInLink(
      { email: 'clinic@example.com', userId: 'user-id', purpose: 'login' },
      {
        auth,
        mailer,
        stateStore: stateStore(),
        siteUrl: 'https://law-clinic-finder.web.app',
        createState: vi.fn().mockResolvedValue(firstPartyState),
        branding: async () => DEFAULT_BRANDING,
      },
    );

    expect(auth.generateSignInWithEmailLink).toHaveBeenCalledWith('clinic@example.com', {
      url: 'https://law-clinic-finder.web.app/auth/confirm',
      handleCodeInApp: true,
    });
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'clinic@example.com',
        subject: 'Dein Anmeldelink',
        text: expect.stringContaining(
          `https://law-clinic-finder.web.app/auth/confirm#oobCode=generated-action-code&state=${firstPartyState}`,
        ),
      }),
    );
  });

  it('removes one-time state when SMTP delivery fails', async () => {
    const store = stateStore();
    const mailer = { send: vi.fn().mockRejectedValue(new Error('smtp unavailable')) };

    await expect(
      sendSignInLink(
        { email: 'clinic@example.com', userId: 'user-id', purpose: 'invite' },
        {
          auth: { generateSignInWithEmailLink: vi.fn().mockResolvedValue(generatedLink) },
          mailer,
          stateStore: store,
          siteUrl: 'https://law-clinic-finder.web.app',
          createState: vi.fn().mockResolvedValue(firstPartyState),
          branding: async () => DEFAULT_BRANDING,
        },
      ),
    ).rejects.toThrow('smtp unavailable');
    expect(store.delete).toHaveBeenCalledWith(expect.any(String));
  });
});
