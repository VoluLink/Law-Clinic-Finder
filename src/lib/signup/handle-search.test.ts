import { describe, expect, it } from 'vitest';

import { searchDirectory, signupSearchSchema, type SignupDeps } from './handle-search';
import { createAdminClientMock, testLogger } from './test-utils';

const clinicRow = {
  id: '9f8b6c3a-0000-4000-8000-000000000001',
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  contact_email: 'kontakt@milcc.de',
  profiles: [],
};

function deps(mock: ReturnType<typeof createAdminClientMock>): SignupDeps {
  return { adminClient: mock.client as never, logger: testLogger() };
}

describe('signupSearchSchema', () => {
  it('accepts an empty query so the directory can be browsed unfiltered', () => {
    expect(signupSearchSchema.safeParse({ query: '' }).success).toBe(true);
  });

  it('rejects a query beyond the length bound', () => {
    expect(signupSearchSchema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe(searchDirectory, () => {
  it('returns masked matches without the full email address', async () => {
    const mock = createAdminClientMock([{ data: [clinicRow], error: null }]);
    const results = await searchDirectory(deps(mock), 'Mietrecht');
    expect(results).toEqual([
      {
        id: clinicRow.id,
        name: clinicRow.name,
        region: 'Köln',
        claimed: false,
        hasContactEmail: true,
        maskedEmail: 'k****t@milcc.de',
      },
    ]);
    expect(JSON.stringify(results)).not.toContain('kontakt@milcc.de');
  });

  it('marks clinics with a linked profile as claimed', async () => {
    const row = { ...clinicRow, profiles: [{ user_id: 'user-1' }] };
    const mock = createAdminClientMock([{ data: [row], error: null }]);
    const results = await searchDirectory(deps(mock), 'Mietrecht');
    expect(results?.[0]?.claimed).toBe(true);
  });

  it('escapes ilike wildcards in the query', async () => {
    const mock = createAdminClientMock([{ data: [], error: null }]);
    await searchDirectory(deps(mock), '100%_legal');
    expect(mock.calls).toContainEqual(['ilike', ['name', '%100\\%\\_legal%']]);
  });

  it('lists the directory unfiltered when the query is empty', async () => {
    const mock = createAdminClientMock([{ data: [clinicRow], error: null }]);
    const results = await searchDirectory(deps(mock), '');
    expect(results).toHaveLength(1);
    expect(mock.calls.map(([method]) => method)).not.toContain('ilike');
  });

  it('returns null and logs when the query fails', async () => {
    const mock = createAdminClientMock([{ data: null, error: { message: 'boom' } }]);
    const searchDeps = deps(mock);
    expect(await searchDirectory(searchDeps, 'Mietrecht')).toBeNull();
    expect(searchDeps.logger.warn).toHaveBeenCalled();
  });
});
