import { describe, expect, it, vi } from 'vitest';

import { requestLoginLink } from './login-link';

vi.mock('server-only', () => ({}));

const EMAIL = 'clinic@example.org';

function dependencies(profile: unknown = { role: 'clinic' }) {
  return {
    findUser: vi.fn().mockResolvedValue({ uid: 'user-1', email: EMAIL }),
    readProfile: vi.fn().mockResolvedValue(profile),
    sendLink: vi.fn().mockResolvedValue(undefined),
  };
}

describe(requestLoginLink, () => {
  it('sends a link only after finding an application profile', async () => {
    const deps = dependencies();
    expect(await requestLoginLink(EMAIL, deps)).toEqual({ status: 'sent' });
    expect(deps.sendLink).toHaveBeenCalledWith({
      email: EMAIL,
      userId: 'user-1',
      purpose: 'login',
    });
  });

  it('does not send to an Auth user without application access', async () => {
    const deps = dependencies(null);
    expect(await requestLoginLink(EMAIL, deps)).toEqual({ status: 'not_found' });
    expect(deps.sendLink).not.toHaveBeenCalled();
  });

  it('uses the same not-found result for an unknown Auth address', async () => {
    const deps = dependencies();
    deps.findUser.mockResolvedValue(null);
    expect(await requestLoginLink(EMAIL, deps)).toEqual({ status: 'not_found' });
  });

  it('normalizes the address before lookup and delivery', async () => {
    const deps = dependencies();
    await requestLoginLink(' CLINIC@Example.org ', deps);
    expect(deps.findUser).toHaveBeenCalledWith(EMAIL);
  });
});
