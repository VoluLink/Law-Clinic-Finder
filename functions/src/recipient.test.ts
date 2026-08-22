import { describe, expect, it, vi } from 'vitest';

import { resolveActiveAdminEmail, type RecipientDependencies } from './recipient.js';

function dependencies(): RecipientDependencies {
  return {
    readProfile: vi.fn().mockResolvedValue({ role: 'admin', accessStatus: 'active' }),
    readAuthEmail: vi.fn().mockResolvedValue('Admin@Example.org'),
  };
}

describe(resolveActiveAdminEmail, () => {
  it('returns the current normalized Auth email for an active admin profile', async () => {
    await expect(resolveActiveAdminEmail('admin-1', dependencies())).resolves.toBe(
      'admin@example.org',
    );
  });

  it('rejects a non-admin profile before reading Authentication', async () => {
    const deps = dependencies();
    vi.mocked(deps.readProfile).mockResolvedValue({ role: 'clinic', accessStatus: 'active' });

    await expect(resolveActiveAdminEmail('clinic-1', deps)).resolves.toBeNull();
    expect(deps.readAuthEmail).not.toHaveBeenCalled();
  });
});
