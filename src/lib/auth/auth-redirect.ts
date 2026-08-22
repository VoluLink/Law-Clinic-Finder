import 'server-only';

import { headers } from 'next/headers';

/**
 * Absolute `/auth/confirm` URL for auth emails. Server-only: every caller sends
 * mail from a route handler, and an earlier `window.location.origin` fallback
 * silently produced `null` there — which dropped `emailRedirectTo` and sent the
 * emailed link to the project's Site URL (the landing page) instead.
 *
 * `NEXT_PUBLIC_SITE_URL` wins so production pins one canonical origin. The
 * request origin is the development fallback. Production always supplies the
 * configured canonical origin, which must also be present in Firebase Auth's
 * authorized-domain list.
 */
export async function authConfirmUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return `${configured}/auth/confirm`;
  const origin = await requestOrigin();
  return origin ? `${origin}/auth/confirm` : null;
}

async function requestOrigin(): Promise<string | null> {
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  if (!host) return null;
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
