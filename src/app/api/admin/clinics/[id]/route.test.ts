import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { updateFailureResponse } from './route';

describe(updateFailureResponse, () => {
  it('allows a successful update response to continue', () => {
    expect(updateFailureResponse({ status: 'ok', notifyPublication: false })).toBeNull();
  });

  it('returns not found for a missing clinic', async () => {
    const response = updateFailureResponse({ status: 'not_found' });
    expect(response?.status).toBe(404);
  });

  it('returns 422 and labels missing publication fields', async () => {
    const response = updateFailureResponse({ status: 'incomplete', missing: ['languages'] });
    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toMatchObject({
      error: expect.stringContaining('Sprache'),
    });
  });

  it('returns 422 for a publication attempt before approval', async () => {
    const response = updateFailureResponse({ status: 'unapproved' });
    expect(response?.status).toBe(422);
  });
});
