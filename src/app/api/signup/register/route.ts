import type { NextRequest } from 'next/server';

import { linkInvitedUser } from '@/lib/admin/invite-clinic';
import { clinicSubmissionSchema } from '@/lib/clinics/schema';
import { firebaseClinicInviteStore } from '@/lib/firebase/clinic-invite-store';
import { firebaseClinicRegistrationStore } from '@/lib/firebase/clinic-registration-store';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { SIGNUP_REGISTER_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { registerClinic } from '@/lib/signup/handle-register';
import { guardSignupRequest, guardSignupSubject } from '@/lib/signup/route-guard';

const limiter = createRateLimiter(SIGNUP_REGISTER_RATE_LIMIT);

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const rejected = guardSignupRequest(request, limiter, logger);
  if (rejected) return rejected;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = clinicSubmissionSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const limited = await guardSignupSubject(request, parsed.data.contact_email, logger);
  if (limited) return limited;

  const inviteDeps = { store: firebaseClinicInviteStore, logger };
  const result = await registerClinic(
    {
      store: firebaseClinicRegistrationStore,
      logger,
      claimWithEmail: (clinicId, email) => linkInvitedUser(inviteDeps, clinicId, email, 'pending'),
    },
    parsed.data,
  );
  if (result.status === 'error') {
    return Response.json({ error: 'Registrierung derzeit nicht möglich.' }, { status: 500 });
  }
  return Response.json(result);
}
