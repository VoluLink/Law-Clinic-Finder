import { describe, expect, it, vi } from 'vitest';

import {
  DEV_ACCOUNTS,
  assertDevEmail,
  buildConfirmPath,
  devLoginEnabled,
  ensureDevSession,
  parseDevLoginRole,
} from './dev-login';

const ENABLED = { NODE_ENV: 'development', DEV_LOGIN_ENABLED: 'true' } as NodeJS.ProcessEnv;

const TOKEN = 'hashed-token-abc';
const USER_ID = '11111111-2222-4333-8444-555555555555';
const CLINIC_ID = '99999999-8888-4777-8666-555555555555';

type MockOptions = {
  createUserError?: string;
  existingUsers?: Array<{ id: string; email: string }>;
  clinicRows?: Array<{ id: string }>;
};

function createClientMock({ createUserError, existingUsers = [], clinicRows }: MockOptions = {}) {
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  const generateLink = vi.fn(() =>
    Promise.resolve({ data: { properties: { hashed_token: TOKEN } }, error: null }),
  );
  const client = {
    auth: {
      admin: {
        // Mirrors Supabase's real shape: `data.user` is null on failure,
        // `data` itself is always present.
        createUser: vi.fn(() =>
          Promise.resolve(
            createUserError
              ? { data: { user: null }, error: { message: createUserError } }
              : { data: { user: { id: USER_ID } }, error: null },
          ),
        ),
        listUsers: vi.fn(() => Promise.resolve({ data: { users: existingUsers }, error: null })),
        generateLink,
      },
    },
    from: (table: string) => {
      if (table === 'profiles') return { upsert };
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: clinicRows ?? [{ id: CLINIC_ID }], error: null }),
        }),
      };
    },
  };
  return { client, upsert, generateLink };
}

describe('devLoginEnabled', () => {
  it('stays off in production even when the flag is set', () => {
    expect(devLoginEnabled({ NODE_ENV: 'production', DEV_LOGIN_ENABLED: 'true' })).toBe(false);
  });

  it('stays off outside production when the flag is absent', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development' })).toBe(false);
  });

  it('requires the flag to be exactly "true", not merely present', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development', DEV_LOGIN_ENABLED: '1' })).toBe(false);
  });

  it('turns on outside production with the flag set', () => {
    expect(devLoginEnabled({ NODE_ENV: 'development', DEV_LOGIN_ENABLED: 'true' })).toBe(true);
  });
});

describe('parseDevLoginRole', () => {
  it('refuses a valid role in production', () => {
    expect(parseDevLoginRole('admin', { NODE_ENV: 'production', DEV_LOGIN_ENABLED: 'true' })).toBe(
      null,
    );
  });

  it('refuses a valid role when the flag is absent', () => {
    expect(parseDevLoginRole('admin', { NODE_ENV: 'development' })).toBe(null);
  });

  it('refuses an unknown role even when enabled', () => {
    expect(parseDevLoginRole('superuser', ENABLED)).toBe(null);
  });

  it('refuses a missing role parameter', () => {
    expect(parseDevLoginRole(null, ENABLED)).toBe(null);
  });

  it('accepts each seeded role when enabled', () => {
    expect(parseDevLoginRole('admin', ENABLED)).toBe('admin');
    expect(parseDevLoginRole('clinic', ENABLED)).toBe('clinic');
  });
});

describe('buildConfirmPath', () => {
  it('escapes the token so it cannot inject extra query parameters', () => {
    expect(buildConfirmPath('a&type=invite')).toBe(
      '/auth/confirm?token_hash=a%26type%3Dinvite&type=magiclink',
    );
  });
});

describe('assertDevEmail', () => {
  it('rejects an address outside the reserved dev domain', () => {
    expect(() => assertDevEmail('real.person@gmail.com')).toThrow(/example\.com/);
  });

  it('accepts a reserved dev address', () => {
    expect(() => assertDevEmail(DEV_ACCOUNTS.admin.email)).not.toThrow();
  });
});

describe('ensureDevSession', () => {
  it('links the clinic account to the resolved clinic row', async () => {
    const { client, upsert } = createClientMock();
    await ensureDevSession(client, 'clinic');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, role: 'clinic', clinic_id: CLINIC_ID, access_status: 'active' },
      { onConflict: 'user_id' },
    );
  });

  it('leaves the admin account unlinked to any clinic', async () => {
    const { client, upsert } = createClientMock();
    await ensureDevSession(client, 'admin');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, role: 'admin', clinic_id: null, access_status: 'active' },
      { onConflict: 'user_id' },
    );
  });

  it('returns the minted magic-link token', async () => {
    const { client } = createClientMock();
    expect(await ensureDevSession(client, 'admin')).toBe(TOKEN);
  });

  it('reuses the existing user when the account was already created', async () => {
    const { client, upsert } = createClientMock({
      createUserError: 'A user with this email address has already been registered',
      existingUsers: [{ id: USER_ID, email: DEV_ACCOUNTS.admin.email }],
    });
    await ensureDevSession(client, 'admin');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID }),
      expect.anything(),
    );
  });

  it('fails loudly when the clinic name matches more than one row', async () => {
    const { client } = createClientMock({ clinicRows: [{ id: CLINIC_ID }, { id: USER_ID }] });
    await expect(ensureDevSession(client, 'clinic')).rejects.toThrow(/exactly 1 clinic/);
  });

  it('surfaces an unexpected createUser failure instead of continuing', async () => {
    const { client } = createClientMock({ createUserError: 'database is on fire' });
    await expect(ensureDevSession(client, 'admin')).rejects.toThrow(/database is on fire/);
  });
});
