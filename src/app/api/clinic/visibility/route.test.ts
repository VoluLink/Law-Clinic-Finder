import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireActiveRole = vi.hoisted(() => vi.fn());
const setClinicVisibility = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/require-role', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/require-role')>('@/lib/auth/require-role');
  return { ...actual, requireActiveRole };
});
vi.mock('@/lib/firebase/clinic-visibility-store', () => ({ setClinicVisibility }));

import { PATCH } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/clinic/visibility', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

function futureDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireActiveRole.mockResolvedValue({ clinic_id: CLINIC_ID, role: 'clinic' });
  setClinicVisibility.mockResolvedValue({ status: 'ok' });
});

describe('PATCH /api/clinic/visibility', () => {
  it('hides an entry indefinitely', async () => {
    const response = await PATCH(request({ state: 'permanent' }) as never);
    expect(response.status).toBe(200);
    expect(setClinicVisibility).toHaveBeenCalledWith(
      CLINIC_ID,
      expect.objectContaining({ isPublished: false, hiddenReason: 'permanent' }),
    );
  });

  it('pauses an entry until a chosen day', async () => {
    const until = futureDay(30);
    await PATCH(request({ state: 'temporary', until }) as never);
    expect(setClinicVisibility).toHaveBeenCalledWith(
      CLINIC_ID,
      expect.objectContaining({ hiddenReason: 'temporary' }),
    );
  });

  it('takes the clinic id from the profile, never from the body', async () => {
    await PATCH(request({ state: 'permanent', clinicId: 'other-clinic' }) as never);
    expect(setClinicVisibility).not.toHaveBeenCalled();
  });

  it('rejects a pause with no return date', async () => {
    const response = await PATCH(request({ state: 'temporary' }) as never);
    expect(response.status).toBe(400);
  });

  it('rejects a return date in the past', async () => {
    const response = await PATCH(request({ state: 'temporary', until: '2020-01-01' }) as never);
    expect(response.status).toBe(400);
  });

  it('rejects a return date beyond the allowed window', async () => {
    const response = await PATCH(request({ state: 'temporary', until: futureDay(400) }) as never);
    expect(response.status).toBe(400);
  });

  it('refuses a cross-origin request', async () => {
    const cross = new Request('http://localhost:3000/api/clinic/visibility', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ state: 'visible' }),
    });
    expect((await PATCH(cross as never)).status).toBe(403);
  });

  it('reports the missing fields when republishing an incomplete entry', async () => {
    setClinicVisibility.mockResolvedValue({ status: 'incomplete', missing: ['website'] });
    const response = await PATCH(request({ state: 'visible' }) as never);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: 'Zum Veröffentlichen fehlt noch: Homepage.',
    });
  });

  it('refuses to republish an entry an admin has not approved', async () => {
    setClinicVisibility.mockResolvedValue({ status: 'unapproved' });
    expect((await PATCH(request({ state: 'visible' }) as never)).status).toBe(422);
  });
});
