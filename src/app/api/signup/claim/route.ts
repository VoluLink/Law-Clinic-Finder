import type { NextRequest } from 'next/server';

import { linkInvitedUser, reinviteClinic } from '@/lib/admin/invite-clinic';
import { isAdminEmail, isClinicEmail } from '@/lib/auth/email-uniqueness';
import { logger } from '@/lib/logger';
import { SIGNUP_CLAIM_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { claimClinic, signupClaimSchema, type ClaimResult } from '@/lib/signup/handle-claim';
import { guardSignupRequest } from '@/lib/signup/route-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const limiter = createRateLimiter(SIGNUP_CLAIM_RATE_LIMIT);

const RESULT_STATUS: Partial<Record<ClaimResult['status'], number>> = {
  not_found: 404,
  error: 500,
};

export async function POST(request: NextRequest): Promise<Response> {
  const rejected = guardSignupRequest(request, limiter);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null);
  const parsed = signupClaimSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const adminClient = createSupabaseAdminClient();
  const deps = { adminClient, logger };
  const result = await claimClinic(
    {
      adminClient,
      logger,
      invite: (clinicId) => reinviteClinic(deps, clinicId),
      claimWithEmail: (clinicId, email) => linkInvitedUser(deps, clinicId, email, 'pending'),
      isEmailTaken: async (email) =>
        (await isAdminEmail(adminClient, email)) || (await isClinicEmail(adminClient, email)),
    },
    parsed.data.clinicId,
    parsed.data.email,
  );
  return Response.json(result, { status: RESULT_STATUS[result.status] ?? 200 });
}
