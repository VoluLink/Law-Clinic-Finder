import { z } from 'zod';

/**
 * Every URL and address that reaches an `href` passes through here.
 *
 * React 19 rewrites a `javascript:` href on its own, which is precisely why the
 * other schemes need a rule of their own: `data:` and `blob:` render
 * attacker-controlled content that the visitor reads as coming from this site,
 * and nothing in the framework stops them.
 */

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export const MAX_EXTERNAL_URL_LENGTH = 500;

/**
 * Parsed the way the browser parses it. A prefix test on the raw string would
 * miss a scheme padded with control characters or split by a newline, both of
 * which the URL parser normalises back to `javascript:`.
 */
export function isSafeExternalUrl(value: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Single source for website validation across the forms, the API and the codecs. */
export const externalUrlSchema = z
  .url()
  .max(MAX_EXTERNAL_URL_LENGTH)
  .refine(isSafeExternalUrl, 'Ungültige URL.');

/**
 * Last gate before a stored URL becomes an href: an unusable value yields no
 * link at all rather than a broken or dangerous one.
 */
export function safeExternalHref(value: string | null): string | null {
  return value !== null && isSafeExternalUrl(value) ? value : null;
}

const MAX_ADDRESS_LENGTH = 200;
/** Anything that could start a second `mailto:` field, or end the address. */
const ADDRESS_SEPARATORS = /[\s<>,;:"'()[\]\\?&#%]/;
const PLAIN_ADDRESS = /^[^@]+@[^@.]+(\.[^@.]+)+$/;

/**
 * A `mailto:` href is a command line for the visitor's mail client — `?cc=`,
 * `&bcc=` and `&body=` are all honoured — so only a plain address may be
 * rendered. A value carrying a separator is dropped rather than escaped,
 * because an escaped separator is still a separator once the client decodes it.
 */
export function safeMailtoAddress(value: string | null): string | null {
  if (value === null) return null;
  const address = value.trim();
  if (address.length > MAX_ADDRESS_LENGTH || ADDRESS_SEPARATORS.test(address)) return null;
  return PLAIN_ADDRESS.test(address) ? address : null;
}
