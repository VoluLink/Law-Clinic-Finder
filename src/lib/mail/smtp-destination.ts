import 'server-only';

import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

/** A/AAAA answers for one name. Injected so tests never perform real DNS. */
export type SmtpAddressResolver = {
  resolve4: (hostname: string) => Promise<string[]>;
  resolve6: (hostname: string) => Promise<string[]>;
};

/** Secret-free classification. It never names the host or the discovered address,
 *  so neither a log line nor an API response can become a network-scan oracle. */
export const SMTP_DESTINATION_REJECTIONS = [
  'ip_literal_host',
  'unresolvable_host',
  'blocked_destination',
] as const;

export type SmtpDestinationRejection = (typeof SMTP_DESTINATION_REJECTIONS)[number];

export type SmtpDestination =
  { ok: true; address: string } | { ok: false; rejection: SmtpDestinationRejection };

const DNS_TIMEOUT_MS = 5_000;
const DNS_TRIES = 2;

/** IANA special-purpose IPv4 blocks. Everything outside them is public unicast. */
const BLOCKED_IPV4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8], // unspecified and "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including the cloud metadata service
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // deprecated 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, including the 255.255.255.255 broadcast address
];

/** IPv6 is deny-by-default: only global unicast passes, minus these carve-outs. */
const GLOBAL_UNICAST_IPV6: readonly [string, number] = ['2000::', 3];

const BLOCKED_IPV6: readonly (readonly [string, number])[] = [
  ['2001::', 32], // Teredo, which tunnels to an arbitrary embedded IPv4 address
  ['2001:2::', 48], // benchmarking
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, which routes to an arbitrary embedded IPv4 address
];

function ipv4ToInt(address: string): number {
  return address.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

function withinIpv4(value: number, [base, prefix]: readonly [string, number]): boolean {
  const block = 2 ** (32 - prefix);
  return Math.floor(value / block) === Math.floor(ipv4ToInt(base) / block);
}

/** Rewrites a trailing dotted-quad into two hex groups so expansion can count groups. */
function foldEmbeddedIpv4(address: string): string {
  const match = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (!match?.[1] || !match[2]) return address;
  const value = ipv4ToInt(match[2]);
  return `${match[1]}${Math.floor(value / 0x10000).toString(16)}:${(value % 0x10000).toString(16)}`;
}

/** Node validated the literal already, so this only has to expand `::`. */
function ipv6Groups(address: string): number[] {
  const [head = '', tail] = foldEmbeddedIpv4(address).split('::');
  const left = head ? head.split(':').map((part) => parseInt(part, 16)) : [];
  const right = tail ? tail.split(':').map((part) => parseInt(part, 16)) : [];
  const gap = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...new Array<number>(Math.max(gap, 0)).fill(0), ...right];
}

function withinIpv6(groups: number[], [base, prefix]: readonly [string, number]): boolean {
  const baseGroups = ipv6Groups(base);
  for (let index = 0; index * 16 < prefix; index += 1) {
    const bits = Math.min(16, prefix - index * 16);
    const mask = (0xffff << (16 - bits)) & 0xffff;
    if (((groups[index] ?? 0) & mask) !== ((baseGroups[index] ?? 0) & mask)) return false;
  }
  return true;
}

/** `::ffff:a.b.c.d` and `::a.b.c.d` address an IPv4 destination, so they are
 *  classified as that IPv4 address instead of as an opaque IPv6 answer. */
function embeddedIpv4(groups: number[]): number | null {
  const leading = groups.slice(0, 5).every((group) => group === 0);
  const mapped = leading && groups[5] === 0xffff;
  const compatible = leading && groups[5] === 0;
  if (!mapped && !compatible) return null;
  return (groups[6] ?? 0) * 0x10000 + (groups[7] ?? 0);
}

function isPublicIpv6(address: string): boolean {
  const groups = ipv6Groups(address);
  const embedded = embeddedIpv4(groups);
  if (embedded !== null) return !BLOCKED_IPV4.some((block) => withinIpv4(embedded, block));
  if (!withinIpv6(groups, GLOBAL_UNICAST_IPV6)) return false;
  return !BLOCKED_IPV6.some((block) => withinIpv6(groups, block));
}

/** True only for an address the server may open an outbound connection to. */
export function isPublicSmtpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    return !BLOCKED_IPV4.some((block) => withinIpv4(value, block));
  }
  return family === 6 ? isPublicIpv6(address) : false;
}

/** A family with no record of its own rejects; that is normal for an A-only or
 *  AAAA-only name and is handled by requiring at least one answer overall. */
async function familyAnswers(resolve: () => Promise<string[]>): Promise<string[]> {
  try {
    return await resolve();
  } catch {
    return [];
  }
}

let sharedResolver: SmtpAddressResolver | null = null;

/** One channel per warm instance. `Resolver` queries the configured nameservers
 *  directly and keeps no answer cache, so every call sees a fresh answer set. */
function defaultResolver(): SmtpAddressResolver {
  if (!sharedResolver) {
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: DNS_TRIES });
    sharedResolver = {
      resolve4: (hostname) => resolver.resolve4(hostname),
      resolve6: (hostname) => resolver.resolve6(hostname),
    };
  }
  return sharedResolver;
}

/**
 * Resolves every A and AAAA answer immediately before a connection is opened and
 * returns the single address the caller must connect to. A mixed answer set is
 * rejected as a whole: the socket layer is free to pick any answer, so one
 * private address in the set is enough to aim the server at an internal host.
 */
export async function resolveSmtpDestination(
  host: string,
  resolver: SmtpAddressResolver = defaultResolver(),
): Promise<SmtpDestination> {
  if (isIP(host) !== 0) return { ok: false, rejection: 'ip_literal_host' };
  const answers = (
    await Promise.all([
      familyAnswers(() => resolver.resolve4(host)),
      familyAnswers(() => resolver.resolve6(host)),
    ])
  ).flat();
  const [first] = answers;
  if (!first) return { ok: false, rejection: 'unresolvable_host' };
  if (!answers.every(isPublicSmtpAddress)) return { ok: false, rejection: 'blocked_destination' };
  return { ok: true, address: first };
}
