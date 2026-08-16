import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './LoginForm';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

function mockFetch(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe(LoginForm, () => {
  beforeEach(() => {
    searchParams.delete('error');
    vi.unstubAllGlobals();
  });

  it('sends the address to the rate-limited login route', async () => {
    const fetchMock = mockFetch(true);
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/E-Mail-Adresse/), 'team@clinic.de');
    await userEvent.click(screen.getByRole('button', { name: /Anmeldelink senden/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ body: JSON.stringify({ email: 'team@clinic.de' }) }),
    );
  });

  it('confirms without revealing whether the account exists', async () => {
    mockFetch(true);
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/E-Mail-Adresse/), 'unbekannt@clinic.de');
    await userEvent.click(screen.getByRole('button', { name: /Anmeldelink senden/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Wenn für diese Adresse/);
  });

  // 'a@b' satisfies the input's own type="email" check but has no real domain,
  // so it is the case that reaches our stricter validation rather than being
  // stopped by the browser first.
  it('rejects a domain-less address before calling the server', async () => {
    const fetchMock = mockFetch(true);
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/E-Mail-Adresse/), 'a@b');
    await userEvent.click(screen.getByRole('button', { name: /Anmeldelink senden/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/gültige E-Mail-Adresse/)).toBeInTheDocument();
  });

  it('explains an expired link instead of showing a blank form', () => {
    searchParams.set('error', '1');
    render(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent(/abgelaufen oder wurde bereits benutzt/);
  });

  it('points a login without a profile at the signup flow', () => {
    searchParams.set('error', 'no_access');
    render(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent(/noch keinen Zugang/);
  });
});
