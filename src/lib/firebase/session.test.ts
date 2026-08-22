import { describe, expect, it, vi } from 'vitest';

import { clearSessionCookie, createSessionCookie, readSessionCookie } from './session';

function cookieStore(value?: string) {
  return {
    get: vi.fn(() => (value ? { value } : undefined)),
    set: vi.fn(),
  };
}

describe(createSessionCookie.name, () => {
  it('stores only a secure bounded HttpOnly cookie in production', async () => {
    const auth = { createSessionCookie: vi.fn().mockResolvedValue('signed-session') };
    const store = cookieStore();

    await createSessionCookie('firebase-id-token', { auth, store, production: true });

    expect(store.set).toHaveBeenCalledWith('__session', 'signed-session', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 432_000,
    });
  });
});

describe(readSessionCookie.name, () => {
  it('verifies revocation before returning a session', async () => {
    const auth = { verifySessionCookie: vi.fn().mockResolvedValue({ uid: 'user-id' }) };

    const session = await readSessionCookie({ auth, store: cookieStore('signed-session') });

    expect(auth.verifySessionCookie).toHaveBeenCalledWith('signed-session', true);
    expect(session).toMatchObject({ uid: 'user-id' });
  });

  it('fails closed for an invalid cookie', async () => {
    const auth = { verifySessionCookie: vi.fn().mockRejectedValue(new Error('invalid')) };

    await expect(
      readSessionCookie({ auth, store: cookieStore('invalid-session') }),
    ).resolves.toBeNull();
  });
});

describe(clearSessionCookie.name, () => {
  it('expires the session cookie immediately', () => {
    const store = cookieStore('signed-session');

    clearSessionCookie(store, true);

    expect(store.set).toHaveBeenCalledWith(
      '__session',
      '',
      expect.objectContaining({ httpOnly: true, secure: true, maxAge: 0 }),
    );
  });
});
