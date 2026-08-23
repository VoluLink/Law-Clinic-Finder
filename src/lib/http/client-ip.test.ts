import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientIp } from './client-ip';

function request(forwardedFor?: string): Request {
  return new Request('https://web--law-clinic-finder.europe-west4.hosted.app/api/chat', {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
}

describe(clientIp, () => {
  it('uses the client address appended immediately before the Google load balancer', () => {
    expect(clientIp(request('198.51.100.200, 203.0.113.10, 192.0.2.1'))).toBe('203.0.113.10');
  });

  it('does not trust a single client-supplied forwarded address', () => {
    expect(clientIp(request('198.51.100.200'))).toBe('unknown');
  });

  it('rejects a malformed trusted address', () => {
    expect(clientIp(request('198.51.100.200, forged, 192.0.2.1'))).toBe('unknown');
  });

  describe('behind Cloudflare', () => {
    afterEach(() => vi.unstubAllEnvs());

    function cloudflareRequest(headers: Record<string, string>): Request {
      return new Request('https://example.test', { headers });
    }

    it('trusts CF-Connecting-IP only when configured to', () => {
      vi.stubEnv('TRUSTED_PROXY', 'cloudflare');
      const request = cloudflareRequest({ 'cf-connecting-ip': '203.0.113.9' });
      expect(clientIp(request)).toBe('203.0.113.9');
    });

    it('ignores CF-Connecting-IP by default, so it cannot be forged', () => {
      const request = cloudflareRequest({ 'cf-connecting-ip': '203.0.113.9' });
      expect(clientIp(request)).toBe('unknown');
    });

    it('ignores a non-IP value', () => {
      vi.stubEnv('TRUSTED_PROXY', 'cloudflare');
      const request = cloudflareRequest({ 'cf-connecting-ip': 'not-an-ip' });
      expect(clientIp(request)).toBe('unknown');
    });

    it('does not fall back to x-forwarded-for when Cloudflare is trusted', () => {
      vi.stubEnv('TRUSTED_PROXY', 'cloudflare');
      const request = cloudflareRequest({ 'x-forwarded-for': '203.0.113.9, 198.51.100.1' });
      expect(clientIp(request)).toBe('unknown');
    });
  });
});
