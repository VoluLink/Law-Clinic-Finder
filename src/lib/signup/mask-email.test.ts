import { describe, expect, it } from 'vitest';

import { maskEmail } from './mask-email';

describe(maskEmail, () => {
  it('keeps first and last local character plus the domain', () => {
    expect(maskEmail('kontakt@milcc.de')).toBe('k****t@milcc.de');
  });

  it('masks single-character local parts without repeating them', () => {
    expect(maskEmail('a@example.org')).toBe('a****@example.org');
  });

  it('falls back to a full mask for malformed addresses', () => {
    expect(maskEmail('not-an-email')).toBe('****');
  });
});
