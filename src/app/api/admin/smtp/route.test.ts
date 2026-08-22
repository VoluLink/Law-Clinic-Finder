import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminRoute = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
const runSmtpChange = vi.hoisted(() => vi.fn());
const activateSmtpSettings = vi.hoisted(() => vi.fn());
const hasEnvironmentSmtpConfig = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/admin-guard', () => ({ requireAdminRoute }));
vi.mock('@/lib/firebase/smtp-settings-store', () => ({
  firebaseSmtpSettingsStore: { load, readActive: vi.fn(), activate: vi.fn() },
}));
vi.mock('@/lib/admin/smtp-change-runner', () => ({ runSmtpChange }));
vi.mock('@/lib/admin/smtp-configuration', () => ({ activateSmtpSettings }));
vi.mock('@/lib/mail/active-config', () => ({ hasEnvironmentSmtpConfig }));

import { GET, PUT } from './route';

const SETTINGS = {
  host: 'smtp.example.net',
  port: 587,
  tlsMode: 'starttls',
  loginEmail: 'login@example.net',
  password: 'active-secret',
  fromEmail: 'no-reply@example.net',
  fromName: 'Law Clinics',
};

const ACTIVE_STATE = {
  status: 'active',
  stored: {
    schemaVersion: 1,
    settings: SETTINGS,
    updatedAt: '2026-08-22T10:00:00.000Z',
    updatedBy: 'admin-uid',
  },
  previous: null,
};

const UPDATE = {
  host: SETTINGS.host,
  port: SETTINGS.port,
  tlsMode: SETTINGS.tlsMode,
  loginEmail: SETTINGS.loginEmail,
  fromEmail: SETTINGS.fromEmail,
  fromName: SETTINGS.fromName,
};

function putRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/smtp', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'key-abcdefgh' },
    body: JSON.stringify(body ?? UPDATE),
  });
}

describe('/api/admin/smtp', () => {
  beforeEach(() => {
    requireAdminRoute.mockReset().mockResolvedValue({ userId: 'admin-uid', authTime: 1 });
    load.mockReset().mockResolvedValue(ACTIVE_STATE);
    hasEnvironmentSmtpConfig.mockReset().mockReturnValue(true);
    runSmtpChange.mockReset().mockResolvedValue(Response.json({ ok: true }));
    activateSmtpSettings.mockReset();
  });

  it('never sends the stored password to the browser', async () => {
    const body = await (await GET(new Request('http://localhost:3000/api/admin/smtp'))).json();

    expect(body).toMatchObject({ source: 'secret', passwordSet: true, provisioned: true });
    expect(JSON.stringify(body)).not.toContain('active-secret');
  });

  it('refuses a caller the admin guard rejected', async () => {
    requireAdminRoute.mockResolvedValue({ response: Response.json({}, { status: 403 }) });

    await expect(GET(new Request('http://localhost:3000/api/admin/smtp'))).resolves.toMatchObject({
      status: 403,
    });
  });

  it('rejects a payload with an unknown field before any change runs', async () => {
    const response = await PUT(putRequest({ ...SETTINGS, provider: 'brevo' }));

    expect(response.status).toBe(400);
    expect(runSmtpChange).not.toHaveBeenCalled();
  });

  it('activates a valid update through the guarded change pipeline', async () => {
    const response = await PUT(putRequest(null));

    expect(response.status).toBe(200);
    expect(runSmtpChange).toHaveBeenCalledTimes(1);
  });
});
