import { describe, expect, it } from 'vitest';

import { stagingAccessState } from './staging-access';

const enabledEnvironment = {
  STAGING_ACCESS_ENABLED: 'true',
  STAGING_ACCESS_USERNAME: 'preview',
  STAGING_ACCESS_PASSWORD: 'a-strong-temporary-password',
};

function basicCredentials(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe(stagingAccessState, () => {
  it('does not gate local environments unless explicitly enabled', () => {
    expect(stagingAccessState(null, {})).toBe('disabled');
  });

  it('fails closed when an enabled gate has incomplete credentials', () => {
    expect(stagingAccessState(null, { STAGING_ACCESS_ENABLED: 'true' })).toBe('misconfigured');
  });

  it('rejects incorrect credentials without exposing which field differs', () => {
    const authorization = basicCredentials('preview', 'an-incorrect-temporary-password');
    expect(stagingAccessState(authorization, enabledEnvironment)).toBe('denied');
  });

  it('accepts the exact configured credentials', () => {
    const authorization = basicCredentials('preview', 'a-strong-temporary-password');
    expect(stagingAccessState(authorization, enabledEnvironment)).toBe('granted');
  });
});
