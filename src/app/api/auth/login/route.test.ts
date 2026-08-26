import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestLoginLink = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => {
  const value = { child: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  value.child.mockReturnValue(value);
  return value;
});

vi.mock('@/lib/auth/login-link', () => ({ requestLoginLink }));
vi.mock('@/lib/logger', () => ({ logger }));

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
  beforeEach(() => requestLoginLink.mockReset().mockResolvedValue({ status: 'sent' }));

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
});
