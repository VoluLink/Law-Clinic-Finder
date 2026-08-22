import { describe, expect, it, vi } from 'vitest';

import { testLogger } from './test-utils';
import { searchDirectory, signupSearchSchema, type SignupDeps } from './handle-search';

const match = {
  id: '9f8b6c3a-0000-4000-8000-000000000001',
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  claimed: false,
  hasContactEmail: true,
  maskedEmail: 'k****t@example.org',
};

function dependencies(): SignupDeps {
  return { store: { search: vi.fn().mockResolvedValue([match]) }, logger: testLogger() };
}

describe('signupSearchSchema', () => {
  it('accepts an empty query', () => {
    expect(signupSearchSchema.safeParse({ query: '' }).success).toBe(true);
  });

  it('rejects an oversized query', () => {
    expect(signupSearchSchema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe(searchDirectory, () => {
  it('returns only the masked projection from the repository', async () => {
    expect(await searchDirectory(dependencies(), 'Mietrecht')).toEqual([match]);
  });

  it('passes an empty query through for directory browsing', async () => {
    const deps = dependencies();
    await searchDirectory(deps, '');
    expect(deps.store.search).toHaveBeenCalledWith('');
  });

  it('returns null and logs a repository failure', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.search).mockRejectedValue(new Error('unavailable'));
    expect(await searchDirectory(deps, 'Mietrecht')).toBeNull();
    expect(deps.logger.warn).toHaveBeenCalledOnce();
  });
});
