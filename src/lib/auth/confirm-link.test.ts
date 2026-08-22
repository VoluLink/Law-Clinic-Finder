import { describe, expect, it, vi } from 'vitest';

import type { ConfirmationPayload } from './confirmation-payload';
import { confirmAuthPayload, type ConfirmationDependencies } from './confirm-link';

const payload: ConfirmationPayload = {
  oobCode: 'generated-action-code',
  state: 'A'.repeat(43),
};

function dependencies(): ConfirmationDependencies {
  return {
    signIn: vi.fn().mockResolvedValue({
      ok: true,
      userId: 'admin-user',
      role: 'admin',
      destination: '/admin',
    }),
    changeEmail: vi.fn().mockResolvedValue({ ok: true }),
    clearSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe(confirmAuthPayload.name, () => {
  it('returns the role destination after successful sign-in', async () => {
    await expect(confirmAuthPayload(payload, dependencies())).resolves.toEqual({
      outcome: 'succeeded',
      destination: '/admin',
    });
  });

  it('returns the no-access message for an identity without a profile', async () => {
    const deps = dependencies();
    vi.mocked(deps.signIn).mockResolvedValue({ ok: false, reason: 'no_access' });
    await expect(confirmAuthPayload(payload, deps)).resolves.toEqual({
      outcome: 'rejected',
      destination: '/login?error=no_access',
      reason: 'no_access',
    });
  });

  it('clears the old session after a confirmed email change', async () => {
    const deps = dependencies();
    await confirmAuthPayload({ ...payload, flow: 'email-change' }, deps);
    expect(deps.clearSession).toHaveBeenCalledOnce();
  });

  it('returns the email-changed destination after confirmation', async () => {
    await expect(
      confirmAuthPayload({ ...payload, flow: 'email-change' }, dependencies()),
    ).resolves.toEqual({ outcome: 'succeeded', destination: '/login?email_changed=1' });
  });

  it('maps unexpected failures to a generic destination without exposing the message', async () => {
    const deps = dependencies();
    vi.mocked(deps.signIn).mockRejectedValue(new Error('sensitive provider response'));
    await expect(confirmAuthPayload(payload, deps)).resolves.toEqual({
      outcome: 'failed',
      destination: '/login?error=1',
      reason: 'Error',
    });
  });
});
