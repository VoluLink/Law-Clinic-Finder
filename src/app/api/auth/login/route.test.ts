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

function loginRequest(): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email: 'unknown@example.org' }),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => requestLoginLink.mockReset().mockResolvedValue({ status: 'sent' }));

  it('returns an explicit not-registered result without sending a link', async () => {
    requestLoginLink.mockResolvedValue({ status: 'not_found' });
    const response = await POST(loginRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'not_registered' });
  });
});
