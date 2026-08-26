import { describe, expect, it } from 'vitest';

import {
  googleLocationSchema,
  googleProjectIdSchema,
  googleSecretIdSchema,
  googleSecretVersionSchema,
} from './resource-names';

/** Values that would move the request off the intended host or path segment. */
const ESCAPES = ['../../etc', 'a/b', 'evil.com', 'x?query=1', 'x#frag', 'a b', 'x%2f', ''];

describe('googleProjectIdSchema', () => {
  it('accepts the deployed project id', () => {
    expect(googleProjectIdSchema.parse('law-clinic-finder')).toBe('law-clinic-finder');
  });

  it.each(ESCAPES)('rejects %j', (value) => {
    expect(googleProjectIdSchema.safeParse(value).success).toBe(false);
  });

  it('rejects an id that starts with a digit', () => {
    expect(googleProjectIdSchema.safeParse('1law-clinic').success).toBe(false);
  });

  it('rejects a trailing hyphen', () => {
    expect(googleProjectIdSchema.safeParse('law-clinic-').success).toBe(false);
  });
});

describe('googleLocationSchema', () => {
  it.each(['europe-west4', 'us-central1', 'northamerica-northeast1', 'eu', 'global'])(
    'accepts %j',
    (value) => {
      expect(googleLocationSchema.parse(value)).toBe(value);
    },
  );

  it.each(ESCAPES)('rejects %j', (value) => {
    expect(googleLocationSchema.safeParse(value).success).toBe(false);
  });

  it('rejects a location that would splice a second host label', () => {
    expect(googleLocationSchema.safeParse('europe-west4.attacker').success).toBe(false);
  });
});

describe('googleSecretIdSchema', () => {
  it('accepts the SMTP settings secret', () => {
    expect(googleSecretIdSchema.parse('smtpSettings')).toBe('smtpSettings');
  });

  it.each(ESCAPES)('rejects %j', (value) => {
    expect(googleSecretIdSchema.safeParse(value).success).toBe(false);
  });
});

describe('googleSecretVersionSchema', () => {
  it.each(['1', '42', 'latest'])('accepts %j', (value) => {
    expect(googleSecretVersionSchema.parse(value)).toBe(value);
  });

  it.each([...ESCAPES, '1:destroy', '-1'])('rejects %j', (value) => {
    expect(googleSecretVersionSchema.safeParse(value).success).toBe(false);
  });
});
