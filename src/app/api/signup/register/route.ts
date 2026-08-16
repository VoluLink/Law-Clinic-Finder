import type { NextRequest } from 'next/server';

import { linkInvitedUser } from '@/lib/admin/invite-clinic';
import { isAdminEmail, isClinicEmail } from '@/lib/auth/email-uniqueness';
import { clinicSubmissionSchema } from '@/lib/clinics/schema';
import { logger } from '@/lib/logger';
import { SIGNUP_REGISTER_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { registerClinic } from '@/lib/signup/handle-register';
import { guardSignupRequest } from '@/lib/signup/route-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const limiter = createRateLimiter(SIGNUP_REGISTER_RATE_LIMIT);

export async function POST(request: NextRequest): Promise<Response> {
  const rejected = guardSignupRequest(request, limiter);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null);
  const parsed = clinicSubmissionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const adminClient = createSupabaseAdminClient();
  const deps = { adminClient, logger };
  const result = await registerClinic(
    {
      ...deps,
      claimWithEmail: (clinicId, email) => linkInvitedUser(deps, clinicId, email, 'pending'),
      isEmailTaken: async (email) =>
        (await isAdminEmail(adminClient, email)) || (await isClinicEmail(adminClient, email)),
    },
    parsed.data,
  );
  if (result.status === 'error') {
    return Response.json({ error: 'Registrierung derzeit nicht möglich.' }, { status: 500 });
  }
  return Response.json(result);
}
