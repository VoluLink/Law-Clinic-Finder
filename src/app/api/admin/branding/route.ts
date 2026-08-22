import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { brandingUpdateSchema, loadBranding } from '@/lib/branding/branding';
import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';
import { requestLogger } from '@/lib/http/request-id';

export async function GET(request?: Request): Promise<Response> {
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  return Response.json({ branding: await loadBranding(firebaseBrandingRepository) });
}

export async function PUT(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = brandingUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  try {
    await firebaseBrandingRepository.update(parsed.data);
  } catch (error) {
    logger.error('branding update failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
