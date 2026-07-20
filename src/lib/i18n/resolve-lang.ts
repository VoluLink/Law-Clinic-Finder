import { DEFAULT_LANG, langSchema, type Lang } from './config';

/**
 * Cookie wins, then the first supported `Accept-Language` entry, then German.
 * Both inputs are untrusted request data — everything passes the zod enum.
 */
export function resolveLang(
  cookieValue: string | undefined,
  acceptLanguage: string | null | undefined,
): Lang {
  const fromCookie = langSchema.safeParse(cookieValue);
  if (fromCookie.success) return fromCookie.data;
  for (const entry of (acceptLanguage ?? '').split(',')) {
    const code = entry.split(';')[0]?.trim().toLowerCase().slice(0, 2);
    const parsed = langSchema.safeParse(code);
    if (parsed.success) return parsed.data;
  }
  return DEFAULT_LANG;
}
