import { describe, expect, it, vi } from 'vitest';

import {
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
  sessionLifetimeSeconds,
} from './session';

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

    await createSessionCookie('firebase-id-token', 'clinic', { auth, store, production: true });

    expect(store.set).toHaveBeenCalledWith('__session', 'signed-session', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 432_000,
    });
  });

  /* An admin cookie can add admins, delete entries and read transcripts, so a
   * stolen one is worth hours rather than days. */
  it('gives an admin a much shorter session than a clinic', async () => {
    expect(sessionLifetimeSeconds('admin')).toBe(8 * 60 * 60);
    expect(sessionLifetimeSeconds('clinic')).toBe(5 * 24 * 60 * 60);
  });

  it('asks Firebase for the same lifetime the cookie carries', async () => {
    const auth = { createSessionCookie: vi.fn().mockResolvedValue('signed-session') };
    const store = cookieStore();

    await createSessionCookie('firebase-id-token', 'admin', { auth, store, production: true });

    expect(auth.createSessionCookie).toHaveBeenCalledWith('firebase-id-token', {
      expiresIn: sessionLifetimeSeconds('admin') * 1_000,
    });
    expect(store.set.mock.calls[0][2].maxAge).toBe(sessionLifetimeSeconds('admin'));
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
