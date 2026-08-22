import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminAccount } from '@/lib/admin/manage-admins';

import { OperationalAlertsPanel } from './OperationalAlertsPanel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

function admin(overrides: Partial<AdminAccount>): AdminAccount {
  return {
    userId: 'admin-1',
    email: 'first@example.com',
    status: 'active',
    createdAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  };
}

const oldest = admin({});
const newer = admin({
  userId: 'admin-2',
  email: 'second@example.com',
  createdAt: '2026-08-11T10:00:00.000Z',
});
const invited = admin({
  userId: 'admin-3',
  email: 'third@example.com',
  status: 'invited',
  createdAt: '2026-08-12T10:00:00.000Z',
});

const defaultRecipient = { userId: oldest.userId, email: oldest.email, source: 'default' } as const;

function renderPanel() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<OperationalAlertsPanel admins={[oldest, newer, invited]} recipient={defaultRecipient} />);
  return fetchMock;
}

describe('OperationalAlertsPanel', () => {
  it('states that the recipient gets every admin mail, not only cloud alerts', () => {
    renderPanel();
    expect(screen.getByText('Admin-Benachrichtigungen')).toBeInTheDocument();
    expect(screen.getByText(/alle E-Mails an die Administration/)).toBeInTheDocument();
    expect(screen.getByText(/Freigabe/)).toBeInTheDocument();
  });

  it('offers the active admins — and only those — as radio options', () => {
    renderPanel();
    const options = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(options.map((option) => option.value)).toEqual([oldest.userId, newer.userId]);
  });

  it('marks the implicit fallback recipient with the Standard badge', () => {
    renderPanel();
    const badged = screen.getByText('Standard').closest('label');
    expect(badged).toHaveTextContent(oldest.email);
  });

  it('saves the selected admin id via PUT', async () => {
    const fetchMock = renderPanel();
    await userEvent.click(screen.getByLabelText(newer.email));
    await userEvent.click(screen.getByRole('button', { name: 'Empfänger speichern' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/operational-alerts',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ userId: newer.userId }) }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/Empfänger gespeichert/);
  });
});
