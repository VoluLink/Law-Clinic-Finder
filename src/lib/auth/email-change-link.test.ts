import { describe, expect, it, vi } from 'vitest';

import type { EmailStateStore } from './email-state';
import { sendEmailChangeLink } from './email-change-link';

const generatedLink =
  'https://law-clinic-finder.firebaseapp.com/__/auth/action?mode=verifyAndChangeEmail&oobCode=generated-action-code&apiKey=public-key';
const firstPartyState = 'A'.repeat(43);

function stateStore(): EmailStateStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    consume: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe(sendEmailChangeLink, () => {
  it('sends a first-party verification link to the new address', async () => {
    const auth = { generateVerifyAndChangeEmailLink: vi.fn().mockResolvedValue(generatedLink) };
    const mailer = { send: vi.fn().mockResolvedValue(undefined) };
    const createState = vi.fn().mockResolvedValue(firstPartyState);
    await sendEmailChangeLink(
      { userId: 'admin-user', currentEmail: 'old@example.org', newEmail: 'new@example.org' },
      {
        auth,
        mailer,
        stateStore: stateStore(),
        siteUrl: 'https://law-clinic-finder.web.app',
        createState,
      },
    );
    expect(auth.generateVerifyAndChangeEmailLink).toHaveBeenCalledWith(
      'old@example.org',
      'new@example.org',
      { url: 'https://law-clinic-finder.web.app/auth/confirm', handleCodeInApp: true },
    );
    expect(createState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'new@example.org', purpose: 'email_change' }),
    );
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.org',
        text: expect.stringContaining(
          `#oobCode=generated-action-code&state=${firstPartyState}&flow=email-change`,
        ),
      }),
    );
  });
});
