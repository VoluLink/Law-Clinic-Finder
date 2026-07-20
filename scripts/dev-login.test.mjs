import { describe, expect, it } from 'vitest';

import { assertDevEmail } from './dev-login.mjs';

// The teardown script deletes accounts, so this guard is the one thing
// standing between a typo and a real user being removed.
describe('assertDevEmail', () => {
  it('accepts a reserved example.com address', () => {
    expect(() => assertDevEmail('admin@example.com')).not.toThrow();
  });

  it('rejects a real deliverable domain', () => {
    expect(() => assertDevEmail('admin@gmail.com')).toThrow(/example\.com/);
  });

  it('rejects a lookalike domain that only contains example.com', () => {
    expect(() => assertDevEmail('admin@example.com.evil.tld')).toThrow(/example\.com/);
  });

  it('rejects an address whose local part merely ends in example.com', () => {
    expect(() => assertDevEmail('example.com@evil.tld')).toThrow(/example\.com/);
  });
});
