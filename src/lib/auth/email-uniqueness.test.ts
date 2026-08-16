import { describe, expect, it } from 'vitest';

import { createAdminClientMock, type QueryResult } from '@/lib/signup/test-utils';

import { isAdminEmail, isClinicEmail } from './email-uniqueness';

function clientWithAdmins(
  profiles: { user_id: string }[],
  usersById: Record<string, string | null>,
) {
  const { client } = createAdminClientMock([{ data: profiles, error: null }]);
  return {
    ...client,
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: usersById[id] ? { id, email: usersById[id] } : null },
        }),
      },
    },
  };
}

describe(isAdminEmail, () => {
  it('recognises an address that already belongs to an admin', async () => {
    const client = clientWithAdmins([{ user_id: 'admin-1' }], { 'admin-1': 'chef@example.com' });
    await expect(isAdminEmail(client as never, 'chef@example.com')).resolves.toBe(true);
  });

  it('ignores case and surrounding whitespace', async () => {
    const client = clientWithAdmins([{ user_id: 'admin-1' }], { 'admin-1': 'chef@example.com' });
    await expect(isAdminEmail(client as never, '  CHEF@Example.com ')).resolves.toBe(true);
  });

  it('reports a free address as unused', async () => {
    const client = clientWithAdmins([{ user_id: 'admin-1' }], { 'admin-1': 'chef@example.com' });
    await expect(isAdminEmail(client as never, 'neu@example.com')).resolves.toBe(false);
  });

  it('reports no admin address when no admin profile exists', async () => {
    const client = clientWithAdmins([], {});
    await expect(isAdminEmail(client as never, 'chef@example.com')).resolves.toBe(false);
  });
});

describe(isClinicEmail, () => {
  const found: QueryResult = { data: [{ id: 'clinic-1' }], error: null };
  const none: QueryResult = { data: [], error: null };

  it('recognises an address already used as a clinic contact address', async () => {
    const { client } = createAdminClientMock([found]);
    await expect(isClinicEmail(client as never, 'beratung@example.com')).resolves.toBe(true);
  });

  it('reports a free address as unused', async () => {
    const { client } = createAdminClientMock([none]);
    await expect(isClinicEmail(client as never, 'neu@example.com')).resolves.toBe(false);
  });

  it('escapes like wildcards so an underscore cannot match a neighbouring address', async () => {
    const { client, calls } = createAdminClientMock([none]);
    await isClinicEmail(client as never, 'a_b@example.com');
    expect(calls).toContainEqual(['ilike', ['contact_email', 'a\\_b@example.com']]);
  });
});
