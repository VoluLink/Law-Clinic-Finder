import { describe, expect, it } from 'vitest';

import {
  externalUrlSchema,
  isSafeExternalUrl,
  safeExternalHref,
  safeMailtoAddress,
} from './external-url';

const UNSAFE_URLS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  '\u0001javascript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'blob:https://example.org/8f2c',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'ftp://example.org/x',
  '//example.org/x',
  '/relative/path',
  'lawclinic.example.org',
  '',
];

describe(isSafeExternalUrl, () => {
  it.each(UNSAFE_URLS)('rejects %j', (value) => {
    expect(isSafeExternalUrl(value)).toBe(false);
  });

  it.each(['https://milcc.de/', 'http://milcc.de/kontakt?ref=finder#top'])(
    'accepts %j',
    (value) => {
      expect(isSafeExternalUrl(value)).toBe(true);
    },
  );
});

describe(safeExternalHref, () => {
  it('passes a plain https link through unchanged', () => {
    expect(safeExternalHref('https://milcc.de/')).toBe('https://milcc.de/');
  });

  it('yields no link at all for an executable scheme', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeNull();
  });

  it('yields no link for a data URL that would render as this site', () => {
    expect(safeExternalHref('data:text/html,<h1>Law Clinic Finder</h1>')).toBeNull();
  });

  it('keeps null as null', () => {
    expect(safeExternalHref(null)).toBeNull();
  });
});

describe('externalUrlSchema', () => {
  it('rejects a javascript URL that z.url() alone accepts', () => {
    expect(externalUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
  });

  it('rejects a URL longer than the stored column allows', () => {
    expect(externalUrlSchema.safeParse(`https://milcc.de/${'a'.repeat(500)}`).success).toBe(false);
  });

  it('accepts the ordinary clinic homepage', () => {
    expect(externalUrlSchema.parse('https://milcc.de/')).toBe('https://milcc.de/');
  });
});

describe(safeMailtoAddress, () => {
  it('passes a plain address through unchanged', () => {
    expect(safeMailtoAddress('kontakt@milcc.de')).toBe('kontakt@milcc.de');
  });

  it.each([
    'kontakt@milcc.de?body=Bitte%20zahlen',
    'kontakt@milcc.de&bcc=angreifer@example.org',
    'kontakt@milcc.de,angreifer@example.org',
    'kontakt@milcc.de%0Abcc:angreifer@example.org',
    'kontakt@milcc.de nachricht',
    'kontakt@milcc',
    'kein-at-zeichen.de',
  ])('drops %j rather than handing it to the mail client', (value) => {
    expect(safeMailtoAddress(value)).toBeNull();
  });

  it('keeps null as null', () => {
    expect(safeMailtoAddress(null)).toBeNull();
  });
});
