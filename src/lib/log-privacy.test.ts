import { describe, expect, it } from 'vitest';

import { REDACTED, sanitizeLogFields } from './log-privacy';

describe(sanitizeLogFields, () => {
  it('keeps ordinary diagnostic fields', () => {
    const fields = { requestId: 'r-1', status: 503, attempt: 2, reason: 'timeout' };
    expect(sanitizeLogFields(fields)).toEqual(fields);
  });

  it.each([
    'password',
    'smtpPassword',
    'token',
    'idToken',
    'actionCode',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    'sessionCookie',
    'credential',
  ])('redacts the value of a field named %s', (key) => {
    expect(sanitizeLogFields({ [key]: 'hunter2' })).toEqual({ [key]: REDACTED });
  });

  it('matches secret-ish names regardless of case or separator', () => {
    expect(sanitizeLogFields({ SMTP_PASSWORD: 'x', 'api-key': 'y' })).toEqual({
      SMTP_PASSWORD: REDACTED,
      'api-key': REDACTED,
    });
  });

  /* Over-redaction is its own failure: a log that hides the status code it was
   * written to explain is no more useful than no log at all. */
  it.each(['statusCode', 'keyword', 'monkeyPatch', 'sessionsPerDay', 'authorName'])(
    'leaves the diagnostic field %s readable',
    (key) => {
      expect(sanitizeLogFields({ [key]: 'visible' })).toEqual({ [key]: 'visible' });
    },
  );

  /* An address is the one identifier that turns an otherwise anonymous log line
   * into personal data, and it most often arrives inside an error message that
   * no caller thought to sanitize. */
  it('redacts an e-mail address wherever it appears in a value', () => {
    const sanitized = sanitizeLogFields({ reason: 'no user record for anna@example.org' });
    expect(sanitized.reason).toBe(`no user record for ${REDACTED}`);
  });

  it('redacts a bearer token inside a value', () => {
    const sanitized = sanitizeLogFields({ reason: 'Authorization: Bearer abc.def.ghi rejected' });
    expect(sanitized.reason).not.toContain('abc.def.ghi');
  });

  it('redacts a JSON web token inside a value', () => {
    const jwt = `${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`;
    expect(String(sanitizeLogFields({ reason: `bad token ${jwt}` }).reason)).not.toContain(jwt);
  });

  it('reaches secrets nested inside objects', () => {
    const sanitized = sanitizeLogFields({ config: { host: 'smtp.example.org', password: 'x' } });
    expect(sanitized.config).toEqual({ host: 'smtp.example.org', password: REDACTED });
  });

  it('reaches secrets nested inside arrays', () => {
    const sanitized = sanitizeLogFields({ attempts: [{ token: 'a' }, { token: 'b' }] });
    expect(sanitized.attempts).toEqual([{ token: REDACTED }, { token: REDACTED }]);
  });

  it('leaves primitives that are not strings alone', () => {
    expect(sanitizeLogFields({ count: 0, ok: false, missing: null })).toEqual({
      count: 0,
      ok: false,
      missing: null,
    });
  });

  /* A whole request body is never a diagnostic, and one deep enough to hide a
   * secret from a bounded walk is itself the signal. */
  it('replaces a structure nested deeper than the walk allows', () => {
    const deep = { a: { b: { c: { d: { e: { password: 'x' } } } } } };
    expect(JSON.stringify(sanitizeLogFields(deep))).not.toContain('"x"');
  });

  it('survives a circular structure', () => {
    const circular: Record<string, unknown> = { requestId: 'r-1' };
    circular.self = circular;
    expect(() => sanitizeLogFields(circular)).not.toThrow();
  });

  it('caps a very long string rather than writing it whole', () => {
    const sanitized = sanitizeLogFields({ reason: 'x'.repeat(5000) });
    expect(String(sanitized.reason).length).toBeLessThan(2100);
  });
});
