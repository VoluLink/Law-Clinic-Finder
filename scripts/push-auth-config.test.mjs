import { describe, expect, it } from 'vitest';

import { mergeAllowList, requiredRedirects } from './push-auth-config.mjs';

describe('requiredRedirects', () => {
  it('includes the production confirm path first', () => {
    expect(requiredRedirects('https://law-clinic-finder.de')).toEqual([
      'https://law-clinic-finder.de/auth/confirm',
      'http://localhost:3000/auth/confirm',
    ]);
  });

  it('ignores a trailing slash on the site url', () => {
    expect(requiredRedirects('https://law-clinic-finder.de/')[0]).toBe(
      'https://law-clinic-finder.de/auth/confirm',
    );
  });

  it('does not duplicate localhost when that is the site url', () => {
    expect(requiredRedirects('http://localhost:3000')).toEqual([
      'http://localhost:3000/auth/confirm',
    ]);
  });

  it('still offers local development when no site url is set', () => {
    expect(requiredRedirects(undefined)).toEqual(['http://localhost:3000/auth/confirm']);
  });
});

describe('mergeAllowList', () => {
  it('keeps entries the project already trusts', () => {
    const merged = mergeAllowList('https://example.org/**,http://localhost:3000', [
      'http://localhost:3000/auth/confirm',
    ]);
    expect(merged).toEqual([
      'https://example.org/**',
      'http://localhost:3000',
      'http://localhost:3000/auth/confirm',
    ]);
  });

  it('does not add an entry twice', () => {
    const merged = mergeAllowList('http://localhost:3000/auth/confirm', [
      'http://localhost:3000/auth/confirm',
    ]);
    expect(merged).toEqual(['http://localhost:3000/auth/confirm']);
  });

  it('accepts an array as returned by some API versions', () => {
    expect(mergeAllowList(['https://a.example'], ['https://b.example'])).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('handles an empty allow list', () => {
    expect(mergeAllowList('', ['http://localhost:3000/auth/confirm'])).toEqual([
      'http://localhost:3000/auth/confirm',
    ]);
  });
});
