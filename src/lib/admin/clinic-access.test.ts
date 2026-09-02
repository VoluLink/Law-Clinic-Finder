import { describe, expect, it } from 'vitest';

import { signInState } from './clinic-access';

describe(signInState, () => {
  it('is invited until the account has been used once', () => {
    expect(signInState(null)).toBe('invited');
    expect(signInState(undefined)).toBe('invited');
  });

  it('is active once a sign-in has been recorded', () => {
    expect(signInState('2026-07-20T10:00:00Z')).toBe('active');
  });
});
