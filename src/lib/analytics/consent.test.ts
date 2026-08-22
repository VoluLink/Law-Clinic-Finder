import { afterEach, describe, expect, it, vi } from 'vitest';

import { readConsent, writeConsent } from './consent';

afterEach(() => {
  document.cookie = 'lcf_consent=; path=/; max-age=0';
  vi.unstubAllEnvs();
  vi.resetModules();
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

describe('GA_MEASUREMENT_ID', () => {
  it('accepts a valid GA4 measurement id', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-ABC1234567');
    const { GA_MEASUREMENT_ID } = await import('./consent');
    expect(GA_MEASUREMENT_ID).toBe('G-ABC1234567');
  });

  it('disables analytics for script-like configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', "G-TEST');alert('unsafe");
    const { GA_MEASUREMENT_ID } = await import('./consent');
    expect(GA_MEASUREMENT_ID).toBe('');
  });
});
