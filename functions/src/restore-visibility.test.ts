import { describe, expect, it, vi } from 'vitest';

import { restoreDueClinics, type RestoreDependencies } from './restore-visibility.js';

function deps(overrides: Partial<RestoreDependencies> = {}): RestoreDependencies {
  return {
    dueClinics: vi.fn().mockResolvedValue([]),
    republish: vi.fn().mockResolvedValue(undefined),
    clearMark: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('restoreDueClinics', () => {
  it('does nothing when no entry is due', async () => {
    const dependencies = deps();
    await expect(restoreDueClinics(dependencies)).resolves.toEqual({ restored: 0, skipped: 0 });
    expect(dependencies.republish).not.toHaveBeenCalled();
  });

  it('republishes an approved entry whose pause has ended', async () => {
    const dependencies = deps({
      dueClinics: vi.fn().mockResolvedValue([{ id: 'c1', approvalStatus: 'approved' }]),
    });
    const outcome = await restoreDueClinics(dependencies);
    expect(dependencies.republish).toHaveBeenCalledWith(['c1']);
    expect(outcome.restored).toBe(1);
  });

  it('never republishes an entry whose approval was withdrawn while paused', async () => {
    const dependencies = deps({
      dueClinics: vi.fn().mockResolvedValue([{ id: 'c1', approvalStatus: 'pending' }]),
    });
    const outcome = await restoreDueClinics(dependencies);
    expect(dependencies.republish).not.toHaveBeenCalled();
    expect(outcome.skipped).toBe(1);
  });

  it('still clears the mark of a skipped entry so it stops being due', async () => {
    const dependencies = deps({
      dueClinics: vi.fn().mockResolvedValue([{ id: 'c1', approvalStatus: 'pending' }]),
    });
    await restoreDueClinics(dependencies);
    expect(dependencies.clearMark).toHaveBeenCalledWith(['c1']);
  });

  it('separates restorable from skipped entries in one run', async () => {
    const dependencies = deps({
      dueClinics: vi.fn().mockResolvedValue([
        { id: 'c1', approvalStatus: 'approved' },
        { id: 'c2', approvalStatus: 'pending' },
        { id: 'c3', approvalStatus: 'approved' },
      ]),
    });
    const outcome = await restoreDueClinics(dependencies);
    expect(dependencies.republish).toHaveBeenCalledWith(['c1', 'c3']);
    expect(outcome).toEqual({ restored: 2, skipped: 1 });
  });
});
