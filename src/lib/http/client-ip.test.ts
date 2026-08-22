import { describe, expect, it } from 'vitest';

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
});
