import { afterEach, describe, expect, it } from 'vitest';

import { readConsent, writeConsent } from './consent';

afterEach(() => {
  document.cookie = 'lcf_consent=; path=/; max-age=0';
});

describe('consent cookie', () => {
  it('returns null when no choice has been made', () => {
    expect(readConsent()).toBeNull();
  });

  it('round-trips a granted choice', () => {
    writeConsent('granted');
    expect(readConsent()).toBe('granted');
  });

  it('round-trips a denied choice', () => {
    writeConsent('denied');
    expect(readConsent()).toBe('denied');
  });
});
