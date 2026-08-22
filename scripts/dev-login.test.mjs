import { describe, expect, it } from 'vitest';

import { assertDevEmail, assertEmulators } from './dev-login.mjs';

// The teardown script deletes accounts, so this guard is the one thing
// standing between a typo and a real user being removed.
describe('assertDevEmail', () => {
  it('accepts a reserved example.com address', () => {
    expect(() => assertDevEmail('admin@example.com')).not.toThrow();
  });

  it('rejects a real deliverable domain', () => {
    expect(() => assertDevEmail('admin@outside.invalid')).toThrow(/example\.com/);
  });

  it('rejects a lookalike domain that only contains example.com', () => {
    expect(() => assertDevEmail('admin@example.com.evil.tld')).toThrow(/example\.com/);
  });

  it('rejects an address whose local part merely ends in example.com', () => {
    expect(() => assertDevEmail('example.com@evil.tld')).toThrow(/example\.com/);
  });
});

describe('assertEmulators', () => {
  it('accepts only loopback Firebase emulator hosts', () => {
    expect(() =>
      assertEmulators({
        NODE_ENV: 'development',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
      }),
    ).not.toThrow();
  });

  it('rejects a teardown aimed at non-loopback services', () => {
    expect(() =>
      assertEmulators({
        NODE_ENV: 'development',
        FIREBASE_AUTH_EMULATOR_HOST: 'firebase.example:9099',
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
      }),
    ).toThrow(/loopback/i);
  });
});
