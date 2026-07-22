import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

const bodySchema = z.object({ email: z.email().max(200) });

// Runs on the admin's own session (not the service client): Supabase sends a
// confirmation to the old and new address, so the change only completes after
// the admin re-verifies by email — the re-auth requirement for account changes.
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  const { error } = await guard.supabase.auth.updateUser({ email: parsed.data.email });
  if (error) {
    logger.error('admin email change failed', { reason: error.message });
    return Response.json({ error: 'E-Mail-Änderung fehlgeschlagen.' }, { status: 400 });
  }
  return Response.json({ ok: true });
}
