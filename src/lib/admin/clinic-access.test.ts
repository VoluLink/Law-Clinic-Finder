import { describe, expect, it } from 'vitest';

import { deriveAccessState, profileUserId } from './clinic-access';

const signedIn = new Map([['u-active', '2026-07-20T10:00:00Z']]);
const invitedOnly = new Map<string, string | null>([['u-invited', null]]);

describe(profileUserId, () => {
  it('reads the id from an embedded array or object, else null', () => {
    expect(profileUserId([{ user_id: 'u1' }])).toBe('u1');
    expect(profileUserId({ user_id: 'u2' })).toBe('u2');
    expect(profileUserId(null)).toBeNull();
    expect(profileUserId([])).toBeNull();
  });
});

describe(deriveAccessState, () => {
  it('is no_email when there is no contact email and no login', () => {
    expect(deriveAccessState({ contact_email: null, profiles: null }, signedIn)).toBe('no_email');
  });

  it('is none when an email exists but no login profile', () => {
    expect(
      deriveAccessState({ contact_email: 'alpha@example.org', profiles: null }, signedIn),
    ).toBe('none');
  });

  it('is invited when a profile exists but the user never signed in', () => {
    const clinic = { contact_email: 'alpha@example.org', profiles: [{ user_id: 'u-invited' }] };
    expect(deriveAccessState(clinic, invitedOnly)).toBe('invited');
  });

  it('is active when the linked user has signed in', () => {
    const clinic = { contact_email: 'alpha@example.org', profiles: [{ user_id: 'u-active' }] };
    expect(deriveAccessState(clinic, signedIn)).toBe('active');
  });
});
