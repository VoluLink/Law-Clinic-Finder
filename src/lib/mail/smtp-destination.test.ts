import { describe, expect, it, vi } from 'vitest';

import { isPublicSmtpAddress, resolveSmtpDestination } from './smtp-destination';

const PUBLIC_V4 = '203.0.114.10';
const PUBLIC_V6 = '2a01:111:f400:7eb::1';

function resolver(answers: { v4?: string[]; v6?: string[] }) {
  return {
    resolve4: vi.fn(() => Promise.resolve(answers.v4 ?? [])),
    resolve6: vi.fn(() => Promise.resolve(answers.v6 ?? [])),
  };
}

/** A family without records rejects instead of returning an empty answer set. */
function noRecords() {
  return Promise.reject(Object.assign(new Error('queryA ENODATA'), { code: 'ENODATA' }));
}

describe(isPublicSmtpAddress.name, () => {
  const blocked = [
    ['loopback IPv4', '127.0.0.1'],
    ['loopback IPv6', '::1'],
    ['unspecified IPv4', '0.0.0.0'],
    ['unspecified IPv6', '::'],
    ['broadcast IPv4', '255.255.255.255'],
    ['link-local IPv4 metadata service', '169.254.169.254'],
    ['link-local IPv6', 'fe80::1'],
    ['private 10/8', '10.4.3.2'],
    ['private 172.16/12', '172.20.0.7'],
    ['private 192.168/16', '192.168.1.25'],
    ['unique local IPv6', 'fd00::5'],
    ['carrier-grade NAT', '100.100.0.1'],
    ['multicast IPv4', '224.0.0.251'],
    ['multicast IPv6', 'ff02::1'],
    ['reserved 240/4', '240.1.2.3'],
    ['IETF protocol assignment', '192.0.0.170'],
    ['benchmarking', '198.19.5.5'],
    ['documentation IPv6', '2001:db8::1'],
    ['Teredo IPv6', '2001:0:4136:e378:8000:63bf:3fff:fdd2'],
    ['6to4 IPv6', '2002:c0a8:0101::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped metadata service', '::ffff:169.254.169.254'],
    ['IPv4-mapped private hex form', '::ffff:a04:302'],
    ['IPv4-compatible private', '::10.4.3.2'],
    ['NAT64 mapped private', '64:ff9b::10.4.3.2'],
  ] as const;

  it.each(blocked)('rejects a %s answer', (_label, address) => {
    expect(isPublicSmtpAddress(address)).toBe(false);
  });

  const allowed = [
    ['public IPv4', PUBLIC_V4],
    ['public IPv6', PUBLIC_V6],
    ['public IPv4 at a range boundary', '100.63.255.255'],
    ['public IPv4 just above a private range', '172.32.0.1'],
  ] as const;

  it.each(allowed)('permits a %s answer', (_label, address) => {
    expect(isPublicSmtpAddress(address)).toBe(true);
  });

  it('rejects a value that is not an IP address at all', () => {
    expect(isPublicSmtpAddress('smtp.example.com')).toBe(false);
  });
});

describe(resolveSmtpDestination.name, () => {
  it('pins the first public answer of a legitimate provider name', async () => {
    await expect(
      resolveSmtpDestination('smtp-relay.brevo.com', resolver({ v4: [PUBLIC_V4] })),
    ).resolves.toEqual({ ok: true, address: PUBLIC_V4 });
  });

  it('rejects an IPv4 literal host without resolving anything', async () => {
    const dns = resolver({ v4: [PUBLIC_V4] });

    await expect(resolveSmtpDestination('169.254.169.254', dns)).resolves.toEqual({
      ok: false,
      rejection: 'ip_literal_host',
    });
    expect(dns.resolve4).not.toHaveBeenCalled();
  });

  it('rejects an IPv6 literal host', async () => {
    await expect(resolveSmtpDestination('::1', resolver({}))).resolves.toEqual({
      ok: false,
      rejection: 'ip_literal_host',
    });
  });

  it('rejects a private IPv4 answer', async () => {
    await expect(
      resolveSmtpDestination('internal.example.com', resolver({ v4: ['10.0.0.5'] })),
    ).resolves.toEqual({ ok: false, rejection: 'blocked_destination' });
  });

  it('rejects a link-local IPv6 answer', async () => {
    await expect(
      resolveSmtpDestination('internal.example.com', resolver({ v6: ['fe80::dead:beef'] })),
    ).resolves.toEqual({ ok: false, rejection: 'blocked_destination' });
  });

  it('rejects a mixed answer set that pairs one public with one private address', async () => {
    await expect(
      resolveSmtpDestination(
        'split.example.com',
        resolver({ v4: [PUBLIC_V4, '192.168.10.10'], v6: [PUBLIC_V6] }),
      ),
    ).resolves.toEqual({ ok: false, rejection: 'blocked_destination' });
  });

  it('rejects an IPv4-mapped IPv6 answer for a private range', async () => {
    await expect(
      resolveSmtpDestination('mapped.example.com', resolver({ v6: ['::ffff:192.168.0.1'] })),
    ).resolves.toEqual({ ok: false, rejection: 'blocked_destination' });
  });

  it('checks the AAAA answers even when the A answers are public', async () => {
    const dns = resolver({ v4: [PUBLIC_V4], v6: ['fd00::1'] });

    await expect(resolveSmtpDestination('split.example.com', dns)).resolves.toEqual({
      ok: false,
      rejection: 'blocked_destination',
    });
    expect(dns.resolve6).toHaveBeenCalledTimes(1);
  });

  it('accepts a name that only has A records', async () => {
    await expect(
      resolveSmtpDestination('ipv4only.example.com', {
        resolve4: () => Promise.resolve([PUBLIC_V4]),
        resolve6: noRecords,
      }),
    ).resolves.toEqual({ ok: true, address: PUBLIC_V4 });
  });

  it('accepts a name that only has AAAA records', async () => {
    await expect(
      resolveSmtpDestination('ipv6only.example.com', {
        resolve4: noRecords,
        resolve6: () => Promise.resolve([PUBLIC_V6]),
      }),
    ).resolves.toEqual({ ok: true, address: PUBLIC_V6 });
  });

  it('rejects a name without any usable answer', async () => {
    await expect(
      resolveSmtpDestination('nowhere.example.com', {
        resolve4: noRecords,
        resolve6: noRecords,
      }),
    ).resolves.toEqual({ ok: false, rejection: 'unresolvable_host' });
  });

  it('reports no host or answer in the rejection so it cannot become an oracle', async () => {
    const result = await resolveSmtpDestination(
      'internal.example.com',
      resolver({ v4: ['169.254.169.254'] }),
    );

    expect(JSON.stringify(result)).toBe('{"ok":false,"rejection":"blocked_destination"}');
  });
});
