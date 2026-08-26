import { describe, expect, it } from 'vitest';

import type { DirectoryMatch } from '@/lib/signup/directory';

import { matchDirectory, SIGNUP_SEARCH_LIMITS } from './signup-directory';

function clinic(name: string): DirectoryMatch {
  return { id: name, name, region: 'Köln', claimed: false, hasContactEmail: true };
}

const rows = [
  clinic('Law Clinic Köln'),
  clinic('Mietrechtsberatung Köln'),
  ...Array.from({ length: 20 }, (_, index) => clinic(`Refugee Law Clinic ${index}`)),
];

describe(matchDirectory, () => {
  it('finds a clinic by a fragment of its name', () => {
    expect(matchDirectory(rows, 'Mietrecht').map((row) => row.name)).toEqual([
      'Mietrechtsberatung Köln',
    ]);
  });

  it('matches case-insensitively', () => {
    expect(matchDirectory(rows, 'mietrecht')).toHaveLength(1);
  });

  /* An empty query used to return the whole approved directory, which let an
   * unauthenticated caller walk every clinic in one request. A claimant knows
   * their own clinic's name, so a short term costs them nothing. */
  it.each(['', ' ', 'La', '  a '])('returns nothing for the too-short query %p', (query) => {
    expect(matchDirectory(rows, query)).toEqual([]);
  });

  it('accepts a query at exactly the minimum length', () => {
    expect(matchDirectory(rows, 'Law').length).toBeGreaterThan(0);
  });

  it('caps how much of the directory one search can return', () => {
    expect(matchDirectory(rows, 'Law')).toHaveLength(SIGNUP_SEARCH_LIMITS.maxMatches);
  });

  it('exposes no address, masked or otherwise', () => {
    const [match] = matchDirectory(rows, 'Mietrecht');
    expect(Object.keys(match)).toEqual(['id', 'name', 'region', 'claimed', 'hasContactEmail']);
  });
});
