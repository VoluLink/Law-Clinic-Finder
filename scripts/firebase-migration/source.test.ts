import { describe, expect, it, vi } from 'vitest';

import { readAllPages, retentionDateColumn, sourceLogoPath } from './source';

describe(readAllPages, () => {
  it('reads bounded pages until the source returns a short page', async () => {
    const readPage = vi
      .fn<(from: number, to: number) => Promise<number[]>>()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([3]);
    await expect(readAllPages(readPage, 2, 10)).resolves.toEqual([1, 2, 3]);
    expect(readPage).toHaveBeenNthCalledWith(2, 2, 3);
  });

  it('fails instead of silently truncating an oversized source dataset', async () => {
    const readPage = vi.fn().mockResolvedValue([1, 2]);
    await expect(readAllPages(readPage, 2, 3)).rejects.toThrow(/limit/i);
  });
});

describe(retentionDateColumn, () => {
  it('uses the legacy sent timestamp for claim requests', () => {
    expect(retentionDateColumn('claim_requests')).toBe('sent_at');
  });

  it('uses the creation timestamp for other retained tables', () => {
    expect(retentionDateColumn('conversations')).toBe('created_at');
  });
});

describe(sourceLogoPath, () => {
  it('accepts only the declared Supabase project branding bucket', () => {
    expect(
      sourceLogoPath(
        'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/branding/logo.svg',
        'abcdefghijklmnopqrst',
      ),
    ).toBe('logo.svg');
  });

  it('rejects logo URLs outside the source branding bucket', () => {
    expect(() =>
      sourceLogoPath(
        'https://evil.example/storage/v1/object/public/branding/logo.svg',
        'abcdefghijklmnopqrst',
      ),
    ).toThrow(/logo/i);
  });
});
