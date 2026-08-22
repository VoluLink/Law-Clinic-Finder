import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmAuthPayload = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => {
  const value = { child: vi.fn(), info: vi.fn(), warn: vi.fn() };
  value.child.mockReturnValue(value);
  return value;
});

vi.mock('@/lib/auth/confirm-link', () => ({ confirmAuthPayload }));
vi.mock('@/lib/logger', () => ({ logger }));

import { POST } from './route';

const payload = {
  oobCode: 'generated-action-code',
  state: 'A'.repeat(43),
};

function request(body: unknown, client = '203.0.113.10', origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/auth/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'localhost:3000',
      origin,
      'x-forwarded-for': `${client}, 192.0.2.1`,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/confirm', () => {
  beforeEach(() => {
    confirmAuthPayload.mockReset().mockResolvedValue({
      outcome: 'succeeded',
      destination: '/admin',
    });
  });

  it('validates and completes a same-origin confirmation', async () => {
    const response = await POST(request(payload));
    await expect(response.json()).resolves.toEqual({ destination: '/admin' });
    expect(confirmAuthPayload).toHaveBeenCalledWith(payload);
  });

  it('marks the confirmation response as non-cacheable', async () => {
    const response = await POST(request(payload, '203.0.113.11'));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a foreign origin before confirmation', async () => {
    const response = await POST(request(payload, '203.0.113.12', 'https://attacker.example'));
    expect(response.status).toBe(403);
    expect(confirmAuthPayload).not.toHaveBeenCalled();
  });

  it('rejects unexpected input fields', async () => {
    const response = await POST(request({ ...payload, destination: '/admin' }, '203.0.113.13'));
    expect(response.status).toBe(400);
  });

  it('rate limits repeated confirmation attempts by trusted client IP', async () => {
    const requests = Array.from({ length: 21 }, () => POST(request(payload, '203.0.113.14')));
    const responses = await Promise.all(requests);
    expect(responses.at(-1)?.status).toBe(429);
  });
});
