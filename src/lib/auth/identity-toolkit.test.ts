import { describe, expect, it, vi } from 'vitest';

import { applyEmailChangeCode, AuthExchangeError, exchangeEmailLink } from './identity-toolkit';

describe(exchangeEmailLink.name, () => {
  it('exchanges the code without persisting the returned refresh token', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        idToken: 'firebase-id-token',
        refreshToken: 'discard-me',
        localId: 'user-id',
        email: 'clinic@example.com',
      }),
    );

    const result = await exchangeEmailLink('clinic@example.com', 'generated-action-code', {
      fetcher,
      endpoint: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=key',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'clinic@example.com', oobCode: 'generated-action-code' }),
      }),
    );
    expect(result).toEqual({
      idToken: 'firebase-id-token',
      userId: 'user-id',
      email: 'clinic@example.com',
    });
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('returns a typed generic error for rejected action codes', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'details' }, { status: 400 }));

    await expect(
      exchangeEmailLink('clinic@example.com', 'generated-action-code', {
        fetcher,
        endpoint: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=key',
      }),
    ).rejects.toBeInstanceOf(AuthExchangeError);
  });
});

describe(applyEmailChangeCode, () => {
  it('applies the verified change code without requesting tokens', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ localId: 'user-id', email: 'new@example.org' }));
    const result = await applyEmailChangeCode('generated-action-code', {
      fetcher,
      endpoint: 'https://identitytoolkit.googleapis.com/v1/accounts:update?key=key',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://identitytoolkit.googleapis.com/v1/accounts:update?key=key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ oobCode: 'generated-action-code' }),
      }),
    );
    expect(result).toEqual({ userId: 'user-id', email: 'new@example.org' });
  });
});
