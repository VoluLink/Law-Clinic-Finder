import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestLoginLink = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => {
  const value = { child: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  value.child.mockReturnValue(value);
  return value;
});

const consumeDurableLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/login-link', () => ({ requestLoginLink }));
vi.mock('@/lib/logger', () => ({ logger }));
vi.mock('@/lib/firebase/durable-limit-store', () => ({ consumeDurableLimit }));

import { POST } from './route';

function loginRequest(
  body: string = JSON.stringify({ email: 'unknown@example.org' }),
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...headers,
    },
    body,
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    requestLoginLink.mockReset().mockResolvedValue({ status: 'sent' });
    consumeDurableLimit.mockReset().mockResolvedValue({ allowed: true, hits: [new Date()] });
  });

  /* Guards that the shared bounded parser is actually wired into this handler:
   * without it, an unauthenticated caller could make the server buffer a body of
   * any size before the schema ever sees it. */
  describe('request body limits', () => {
    it('refuses a body larger than the ceiling before parsing it', async () => {
      const oversized = JSON.stringify({ email: `${'a'.repeat(70 * 1024)}@example.org` });
      const response = await POST(loginRequest(oversized));

      expect(response.status).toBe(413);
      expect(requestLoginLink).not.toHaveBeenCalled();
    });

    it('refuses a body that is not declared as JSON', async () => {
      const response = await POST(loginRequest(undefined, { 'Content-Type': 'text/plain' }));

      expect(response.status).toBe(415);
      expect(requestLoginLink).not.toHaveBeenCalled();
    });

    it('still accepts an ordinary body', async () => {
      const response = await POST(loginRequest());

      expect(response.status).toBe(200);
      expect(requestLoginLink).toHaveBeenCalled();
    });
  });

  it('returns an explicit not-registered result without sending a link', async () => {
    requestLoginLink.mockResolvedValue({ status: 'not_found' });
    const response = await POST(loginRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'not_registered' });
  });

  /* The per-instance limiter above resets on every cold start, so this is the
   * one that actually bounds how much auth mail one address can trigger. */
  describe('durable per-address limit', () => {
    it('counts the request against the normalised address, not the IP', async () => {
      await POST(loginRequest(JSON.stringify({ email: 'Clinic@Example.org' })));

      expect(consumeDurableLimit).toHaveBeenCalledWith(
        'login',
        'Clinic@Example.org',
        expect.objectContaining({ maxRequests: expect.any(Number) }),
      );
    });

    it('refuses to send a further link once the address is over its window', async () => {
      consumeDurableLimit.mockResolvedValue({ allowed: false, retryAfterMs: 90_000 });

      const response = await POST(loginRequest());

      expect(response.status).toBe(429);
      expect(requestLoginLink).not.toHaveBeenCalled();
    });

    it('tells the caller when the window lifts', async () => {
      consumeDurableLimit.mockResolvedValue({ allowed: false, retryAfterMs: 90_000 });

      const response = await POST(loginRequest());

      expect(response.headers.get('retry-after')).toBe('90');
    });

    it('sends no mail at all when the durable limit cannot be read', async () => {
      consumeDurableLimit.mockRejectedValue(new Error('firestore unavailable'));

      const response = await POST(loginRequest());

      expect(response.status).toBe(503);
      expect(requestLoginLink).not.toHaveBeenCalled();
    });
  });
});
