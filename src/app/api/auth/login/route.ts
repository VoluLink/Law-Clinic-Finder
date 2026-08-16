import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { authConfirmUrl } from '@/lib/auth/auth-redirect';
import { clientIp } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import { logger } from '@/lib/logger';
import { LOGIN_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const limiter = createRateLimiter(LOGIN_RATE_LIMIT);
const loginSchema = z.object({ email: z.email() });

/**
 * Sends the magic link. The browser could call Supabase directly with the
 * public anon key, but then the per-IP limit would have nowhere to live — every
 * auth mail comes out of one project-wide hourly quota, so an unthrottled
 * endpoint lets a single abuser lock every real clinic out.
 *
 * The reply never says whether the address exists: that would turn the login
 * form into a way to test which clinics are registered.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  if (limiter.isLimited(clientIp(request))) {
    logger.warn('login link rate limited');
    return Response.json(
      { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const redirectTo = await authConfirmUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    // Accounts are created in the signup flows, never here.
    options: { shouldCreateUser: false, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  // The address itself never reaches the log — these lines exist to tell
  // "nothing was sent" apart from "sent but never opened" when debugging.
  if (error) logger.info('login link not sent', { reason: error.message });
  else logger.info('login link sent', { redirected: Boolean(redirectTo) });
  return Response.json({ status: 'ok' });
}
