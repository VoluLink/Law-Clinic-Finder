import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SmtpSettingsView } from '@/lib/mail/smtp-settings';

import { SmtpForm } from './SmtpForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const ACTIVE_VIEW: SmtpSettingsView = {
  provisioned: true,
  source: 'secret',
  passwordSet: true,
  values: {
    host: 'smtp.example.net',
    port: 587,
    tlsMode: 'starttls',
    loginEmail: 'login@example.net',
    fromEmail: 'no-reply@example.net',
    fromName: 'Law Clinics',
  },
  updatedAt: '2026-08-22T10:00:00.000Z',
  updatedBy: 'admin-uid',
  rollbackAvailable: true,
};

function stubFetch(status = 200, body: unknown = { ok: true, version: '4', changed: ['host'] }) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('SmtpForm', () => {
  it('shows the password only as set and never as a value', () => {
    render(<SmtpForm view={ACTIVE_VIEW} />);

    expect(screen.getByText('Passwort gesetzt')).toBeInTheDocument();
    expect(screen.getByLabelText(/Passwort \/ API-Key/, { selector: 'input' })).toHaveValue('');
  });

  it('omits the password from the payload when the field is left empty', async () => {
    const fetchMock = stubFetch();
    render(<SmtpForm view={ACTIVE_VIEW} />);

    await userEvent.click(screen.getByRole('button', { name: /Prüfen/ }));

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).not.toHaveProperty('password');
    expect(options.headers['idempotency-key']).toEqual(expect.any(String));
  });

  it('reuses one idempotency key while the same payload is retried', async () => {
    const fetchMock = stubFetch(422, { error: 'Anmeldung fehlgeschlagen.' });
    render(<SmtpForm view={ACTIVE_VIEW} />);

    await userEvent.click(screen.getByRole('button', { name: /Prüfen/ }));
    await userEvent.click(screen.getByRole('button', { name: /Prüfen/ }));

    const keys = fetchMock.mock.calls.map(([, options]) => options.headers['idempotency-key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it('surfaces the server-side verification error', async () => {
    stubFetch(422, {
      error: 'Anmeldung am SMTP-Server fehlgeschlagen. Login oder Passwort prüfen.',
    });
    render(<SmtpForm view={ACTIVE_VIEW} />);

    await userEvent.click(screen.getByRole('button', { name: /Prüfen/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Anmeldung am SMTP-Server');
  });

  it('locks the editor while the secret is not provisioned', () => {
    render(
      <SmtpForm
        view={{
          provisioned: false,
          source: 'environment',
          passwordSet: true,
          values: null,
          updatedAt: null,
          updatedBy: null,
          rollbackAvailable: false,
        }}
      />,
    );

    expect(screen.getByLabelText('Host')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Prüfen/ })).toBeDisabled();
  });

  it('offers a rollback only when a previous version exists', () => {
    render(<SmtpForm view={{ ...ACTIVE_VIEW, rollbackAvailable: false }} />);

    expect(screen.getByRole('button', { name: /zurücksetzen/ })).toBeDisabled();
  });
});
