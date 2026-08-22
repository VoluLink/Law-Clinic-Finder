import { describe, expect, it } from 'vitest';

import { guardSmtpChange, smtpActivationResponse } from './smtp-change-request';

const NOW = new Date('2026-08-22T12:00:00.000Z');
const RECENT_AUTH = Math.floor(NOW.getTime() / 1_000) - 60;
const KEY = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function request(headers: Record<string, string> = { 'idempotency-key': KEY }): Request {
  return new Request('http://localhost:3000/api/admin/smtp', { method: 'PUT', headers });
}

describe(guardSmtpChange.name, () => {
  it('accepts a recently authenticated admin with an idempotency key', () => {
    const result = guardSmtpChange(request(), { userId: 'admin-a', authTime: RECENT_AUTH }, NOW);

    expect(result).toMatchObject({
      actorId: 'admin-a',
      storeKey: `smtp-settings:admin-a:${KEY}`,
    });
  });

  it('demands a fresh sign-in for a stale session', async () => {
    const stale = { userId: 'admin-b', authTime: RECENT_AUTH - 3_600 };

    const result = guardSmtpChange(request(), stale, NOW);

    expect(result).toHaveProperty('response');
    expect((result as { response: Response }).response.status).toBe(401);
  });

  it('rejects a change without an idempotency key', () => {
    const result = guardSmtpChange(request({}), { userId: 'admin-c', authTime: RECENT_AUTH }, NOW);

    expect((result as { response: Response }).response.status).toBe(400);
  });

  it('limits repeated attempts by the same admin', () => {
    const caller = { userId: 'admin-d', authTime: RECENT_AUTH };
    for (let attempt = 0; attempt < 10; attempt += 1) guardSmtpChange(request(), caller, NOW);

    const result = guardSmtpChange(request(), caller, NOW);

    expect((result as { response: Response }).response.status).toBe(429);
  });
});

describe(smtpActivationResponse.name, () => {
  it('returns the new version and changed field names without any secret', async () => {
    const response = smtpActivationResponse({
      status: 'activated',
      version: '4',
      changed: ['host', 'password'],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: '4',
      changed: ['host', 'password'],
    });
  });

  it('explains an authentication failure without echoing the server message', async () => {
    const response = smtpActivationResponse({
      status: 'verification_failed',
      failure: 'authentication',
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ failure: 'authentication' });
  });

  it('reports an unprovisioned secret as unavailable', () => {
    expect(smtpActivationResponse({ status: 'not_provisioned' }).status).toBe(503);
  });

  it('reports a missing rollback target as a conflict', () => {
    expect(smtpActivationResponse({ status: 'no_rollback_target' }).status).toBe(409);
  });
});
