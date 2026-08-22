import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from './security-headers';

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
