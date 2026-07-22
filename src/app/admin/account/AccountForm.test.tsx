import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountForm } from './AccountForm';

afterEach(() => vi.unstubAllGlobals());

describe('AccountForm', () => {
  it('shows the current email and disables save until it changes', () => {
    render(<AccountForm currentEmail="admin@example.com" />);
    expect(screen.getByText('Aktuell: admin@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('requests the email change and confirms an email was sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AccountForm currentEmail="admin@example.com" />);
    const input = screen.getByLabelText('E-Mail-Adresse');
    await userEvent.clear(input);
    await userEvent.type(input, 'neu@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/account/email',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByText(/Bestätigungs-E-Mail/)).toBeInTheDocument();
  });
});
