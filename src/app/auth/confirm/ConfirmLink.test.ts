import { describe, expect, it, vi } from 'vitest';

import type { ConfirmationPayload } from '@/lib/auth/confirmation-payload';

import { postConfirmation, runConfirmation, type ConfirmationRuntime } from './ConfirmLink';

const fragment = `#oobCode=generated-action-code&state=${'A'.repeat(43)}`;
const payload: ConfirmationPayload = {
  oobCode: 'generated-action-code',
  state: 'A'.repeat(43),
};

function runtime(): ConfirmationRuntime {
  return {
    clearFragment: vi.fn(),
    post: vi.fn().mockResolvedValue('/admin'),
    navigate: vi.fn(),
  };
}

describe(runConfirmation.name, () => {
  it('clears the fragment before submitting its validated payload', async () => {
    const browser = runtime();
    await runConfirmation(fragment, browser);
    expect(browser.post).toHaveBeenCalledWith(payload);
    expect(vi.mocked(browser.clearFragment).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(browser.post).mock.invocationCallOrder[0],
    );
  });

  it('navigates to the server-approved destination', async () => {
    const browser = runtime();
    await runConfirmation(fragment, browser);
    expect(browser.navigate).toHaveBeenCalledWith('/admin');
  });

  it('does not submit an invalid fragment', async () => {
    const browser = runtime();
    await runConfirmation('#state=invalid', browser);
    expect(browser.post).not.toHaveBeenCalled();
    expect(browser.navigate).toHaveBeenCalledWith('/login?error=1');
  });

  it('uses the generic error destination after a request failure', async () => {
    const browser = runtime();
    vi.mocked(browser.post).mockRejectedValue(new Error('network detail'));
    await runConfirmation(fragment, browser);
    expect(browser.navigate).toHaveBeenCalledWith('/login?error=1');
  });
});

describe(postConfirmation.name, () => {
  it('rejects a non-local destination returned by the network', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ destination: 'https://attacker.example' }));
    await expect(postConfirmation(payload, fetcher)).resolves.toBe('/login?error=1');
  });
});
