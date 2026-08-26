/**
 * Last line of defence at the logging boundary.
 *
 * Every call site is supposed to log a reason rather than a payload, but that
 * is a rule a hundred call sites have to keep remembering, and an error message
 * from a third-party library can carry an address or a token that no caller
 * chose to include. Sanitizing centrally means a mistake in one handler cannot
 * put personal data into stdout or the admin log (AR-6, VS-7, EL-9).
 */
import type { LogFields } from './logger';

export const REDACTED = '[redacted]';

/**
 * Substrings unambiguous enough that any name containing one is a secret.
 * A bare `code` is deliberately absent: it would redact `statusCode` and
 * similar diagnostics, so the credential-bearing spellings are listed instead.
 */
const SECRET_NAME_SUBSTRINGS = [
  'actioncode',
  'apikey',
  'authorization',
  'cookie',
  'credential',
  'oobcode',
  'passwd',
  'password',
  'secret',
  'signature',
  'token',
] as const;

/** Words that only mean a secret when they are a whole segment of the name, so
 *  `key` redacts `key` and `api_key` but not `keyword` or `monkeyPatch`. */
const SECRET_NAME_SEGMENTS = ['key', 'session', 'auth', 'pin', 'otp'] as const;

function segmentsOf(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BEARER = /\bBearer\s+[\w.\-~+/]+=*/gi;
const JWT = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

const MAX_DEPTH = 4;
const MAX_STRING = 2_048;
const MAX_ITEMS = 50;

function isSecretName(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SECRET_NAME_SUBSTRINGS.some((part) => normalized.includes(part))) return true;
  const segments = segmentsOf(key);
  return SECRET_NAME_SEGMENTS.some((word) => segments.includes(word));
}

function sanitizeString(value: string): string {
  const capped = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  return capped.replace(BEARER, REDACTED).replace(JWT, REDACTED).replace(EMAIL, REDACTED);
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH || seen.has(value)) return REDACTED;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
  }
  return sanitizeRecord(value as LogFields, depth + 1, seen);
}

function sanitizeRecord(fields: LogFields, depth: number, seen: WeakSet<object>): LogFields {
  const output: LogFields = {};
  for (const [key, value] of Object.entries(fields).slice(0, MAX_ITEMS)) {
    output[key] = isSecretName(key) ? REDACTED : sanitizeValue(value, depth, seen);
  }
  return output;
}

export function sanitizeLogFields(fields: LogFields): LogFields {
  return sanitizeRecord(fields, 0, new WeakSet());
}
