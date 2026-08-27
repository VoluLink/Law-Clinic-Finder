import { describe, expect, it } from 'vitest';

import {
  contentSecurityPolicy,
  requiresPrivateCache,
  STATIC_SECURITY_HEADERS,
} from './security-headers';

describe(contentSecurityPolicy, () => {
  it('allows only self and the request nonce to execute scripts in production', () => {
    const policy = contentSecurityPolicy('test-nonce', false);

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('allows the React development evaluator only outside production', () => {
    expect(contentSecurityPolicy('test-nonce', true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy('test-nonce', false)).not.toContain("'unsafe-eval'");
  });

  it('upgrades insecure requests only in production', () => {
    expect(contentSecurityPolicy('test-nonce', false)).toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy('test-nonce', true)).not.toContain('upgrade-insecure-requests');
  });
  /* Both directives allowed a Google host purely so the admin font selector
     could load a stylesheet. The faces are vendored now, so a re-added
     exception here would be a privacy regression, not a styling fix. */
  it('allows no external origin to serve styles or fonts', () => {
    const policy = contentSecurityPolicy('test-nonce', false);
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).not.toContain('fonts.googleapis.com');
    expect(policy).not.toContain('fonts.gstatic.com');
  });
});

describe('STATIC_SECURITY_HEADERS', () => {
  it('prevents the application from being embedded', () => {
    expect(STATIC_SECURITY_HEADERS).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
  });

  it('disables browser access to unneeded device capabilities', () => {
    const policy = STATIC_SECURITY_HEADERS.find(({ key }) => key === 'Permissions-Policy');
    expect(policy?.value).toContain('camera=()');
  });
});

describe(requiresPrivateCache, () => {
  it.each([
    '/api/chat',
    '/api/admin/smtp',
    '/admin',
    '/admin/logs',
    '/clinic',
    '/clinic/account',
    '/auth/confirm',
  ])('marks %s private', (pathname) => {
    expect(requiresPrivateCache(pathname)).toBe(true);
  });

  /* The public pages are the whole point of the site being fast; they carry no
   * session state and stay cacheable. */
  it.each(['/', '/impressum', '/datenschutz', '/login', '/signup'])(
    'leaves %s cacheable',
    (pathname) => {
      expect(requiresPrivateCache(pathname)).toBe(false);
    },
  );

  it('does not treat a lookalike public path as private', () => {
    expect(requiresPrivateCache('/administrative-info')).toBe(false);
  });
});
