import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderClinicSubmissionEmail = vi.hoisted(() =>
  vi.fn(() => ({ subject: 'Ein neuer Eintrag wartet auf deine Freigabe', text: 't', html: 'h' })),
);
const renderClinicPublishedEmail = vi.hoisted(() =>
  vi.fn(() => ({ subject: 'Euer Eintrag ist freigegeben', text: 't', html: 'h' })),
);

vi.mock('./clinic-notification-email', () => ({
  renderClinicSubmissionEmail,
  renderClinicPublishedEmail,
}));
vi.mock('./active-config', () => ({ activeMailer: vi.fn() }));
vi.mock('@/lib/admin/manage-admins', () => ({ listAdmins: vi.fn() }));
vi.mock('@/lib/admin/operational-alerts', () => ({ loadOperationalAlertRecipient: vi.fn() }));
vi.mock('@/lib/firebase/admin-account-store', () => ({ firebaseAdminAccountStore: {} }));
vi.mock('@/lib/firebase/branding-repository', () => ({ firebaseBrandingRepository: {} }));
vi.mock('@/lib/firebase/clinic-notice-store', () => ({ releaseClinicNotice: vi.fn() }));
vi.mock('@/lib/firebase/clinic-repository', () => ({ readClinic: vi.fn() }));
vi.mock('@/lib/firebase/env', () => ({ firebaseConfig: vi.fn() }));
vi.mock('@/lib/firebase/operational-alert-store', () => ({ firebaseOperationalAlertStore: {} }));

import { DEFAULT_BRANDING } from '@/lib/branding/branding';

import {
  sendClinicPublishedNotice,
  sendClinicSubmissionNotice,
  type ClinicNoticeDependencies,
} from './clinic-notifications';

const CLINIC = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Law and Lake',
  contact_email: 'clinic@example.org',
  legal_areas: 'Mietrecht',
  updated_at: '2026-08-22T10:00:00.000Z',
};

const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };

function dependencies(overrides: Partial<ClinicNoticeDependencies> = {}): ClinicNoticeDependencies {
  return {
    readClinic: vi.fn().mockResolvedValue(CLINIC),
    release: vi.fn().mockResolvedValue(undefined),
    branding: vi.fn().mockResolvedValue(DEFAULT_BRANDING),
    send: vi.fn().mockResolvedValue(undefined),
    adminRecipient: vi.fn().mockResolvedValue('admin@example.org'),
    siteUrl: () => 'https://example.test',
    ...overrides,
  };
}

describe(sendClinicSubmissionNotice.name, () => {
  beforeEach(() => {
    logger.warn.mockReset();
    logger.error.mockReset();
    logger.info.mockReset();
  });

  it('sends to the single admin who receives admin communication', async () => {
    const deps = dependencies();

    await sendClinicSubmissionNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.org', subject: expect.any(String) }),
    );
    expect(vi.mocked(deps.release)).not.toHaveBeenCalled();
  });

  it('releases the mark when no admin can receive it', async () => {
    const deps = dependencies({ adminRecipient: vi.fn().mockResolvedValue(null) });

    await sendClinicSubmissionNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.send)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.release)).toHaveBeenCalledWith(CLINIC.id, 'submissionNotifiedAt');
  });

  it('releases the mark when delivery fails so a later save retries', async () => {
    const deps = dependencies({ send: vi.fn().mockRejectedValue(new Error('smtp down')) });

    await sendClinicSubmissionNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.release)).toHaveBeenCalledWith(CLINIC.id, 'submissionNotifiedAt');
    expect(logger.error).toHaveBeenCalledWith(
      'clinic notice failed',
      expect.objectContaining({ clinicId: CLINIC.id, reason: 'Error' }),
    );
  });

  it('never logs the clinic name or any address', async () => {
    const deps = dependencies({ send: vi.fn().mockRejectedValue(new Error('smtp down')) });

    await sendClinicSubmissionNotice(CLINIC.id, logger, deps);

    const logged = JSON.stringify([
      logger.info.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
    ]);
    expect(logged).not.toContain('Law and Lake');
    expect(logged).not.toContain('@example.org');
  });
});

describe(sendClinicPublishedNotice.name, () => {
  beforeEach(() => logger.warn.mockReset());

  it('sends to the clinic contact address', async () => {
    const deps = dependencies();

    await sendClinicPublishedNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.send)).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'clinic@example.org' }),
    );
    expect(renderClinicPublishedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ siteUrl: 'https://example.test' }),
    );
  });

  it('releases the mark when the clinic has no contact address', async () => {
    const deps = dependencies({
      readClinic: vi.fn().mockResolvedValue({ ...CLINIC, contact_email: null }),
    });

    await sendClinicPublishedNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.send)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.release)).toHaveBeenCalledWith(CLINIC.id, 'publishNotifiedAt');
  });

  it('releases the mark when the clinic disappeared before delivery', async () => {
    const deps = dependencies({ readClinic: vi.fn().mockResolvedValue(null) });

    await sendClinicPublishedNotice(CLINIC.id, logger, deps);

    expect(vi.mocked(deps.release)).toHaveBeenCalledWith(CLINIC.id, 'publishNotifiedAt');
  });
});
