import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isSameOrigin } from './same-origin';

function request(origin: string, host = 'law-clinic-finder.web.app'): Request {
  return new Request('https://law-clinic-finder.web.app/api/write', {
    method: 'POST',
    headers: { host, origin },
  });
}

describe(isSameOrigin, () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', ''));
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the configured public origin behind an App Hosting proxy', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://web--law-clinic-finder.europe-west4.hosted.app');
    const proxied = new Request('https://web-1028562246980.europe-west4.run.app/api/write', {
      method: 'POST',
      headers: {
        host: 'web-1028562246980.europe-west4.run.app',
        origin: 'https://web--law-clinic-finder.europe-west4.hosted.app',
      },
    });

    expect(isSameOrigin(proxied)).toBe(true);
  });

  it('rejects an unconfigured origin behind an App Hosting proxy', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://web--law-clinic-finder.europe-west4.hosted.app');
    const proxied = new Request('https://web-1028562246980.europe-west4.run.app/api/write', {
      method: 'POST',
      headers: {
        host: 'web-1028562246980.europe-west4.run.app',
        origin: 'https://attacker.example',
      },
    });

    expect(isSameOrigin(proxied)).toBe(false);
  });

  it('accepts an exact origin match', () => {
    expect(isSameOrigin(request('https://law-clinic-finder.web.app'))).toBe(true);
  });

  it('rejects the same host on a different scheme', () => {
    expect(isSameOrigin(request('http://law-clinic-finder.web.app'))).toBe(false);
  });

  it('rejects a Host header that disagrees with the request URL', () => {
    expect(isSameOrigin(request('https://attacker.example', 'attacker.example'))).toBe(false);
  });
});
