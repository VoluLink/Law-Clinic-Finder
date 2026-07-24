import { describe, expect, it } from 'vitest';

import { emailValue, INVALID_EMAIL_MESSAGE, isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('team@law-clinic.de')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmail('  team@law-clinic.de  ')).toBe(true);
  });

  it('rejects a value that is not an email', () => {
    expect(isValidEmail('nope')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('emailValue', () => {
  it('reports the German message on an invalid address', () => {
    const result = emailValue.safeParse('nope');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(INVALID_EMAIL_MESSAGE);
  });

  it('rejects an address longer than 200 characters', () => {
    const tooLong = `${'a'.repeat(200)}@x.de`;
    expect(emailValue.safeParse(tooLong).success).toBe(false);
  });
});
