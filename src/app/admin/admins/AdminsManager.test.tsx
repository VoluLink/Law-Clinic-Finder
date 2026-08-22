import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AdminsManager } from './AdminsManager';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('AdminsManager', () => {
  it('groups the current admin email settings with admin management', () => {
    render(
      <AdminsManager
        admins={[
          {
            userId: 'admin-1',
            email: 'admin@example.com',
            status: 'active',
            createdAt: '2026-08-10T10:00:00.000Z',
          },
        ]}
        currentEmail="admin@example.com"
        currentUserId="admin-1"
        operationalAlertRecipient={{
          userId: 'admin-1',
          email: 'admin@example.com',
          source: 'default',
        }}
      />,
    );

    expect(screen.getByText('Admin-E-Mail-Adresse')).toBeInTheDocument();
  });

  it('saves the selected operational-alert recipient', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AdminsManager
        admins={[
          {
            userId: 'admin-1',
            email: 'first@example.com',
            status: 'active',
            createdAt: '2026-08-10T10:00:00.000Z',
          },
          {
            userId: 'admin-2',
            email: 'second@example.com',
            status: 'active',
            createdAt: '2026-08-11T10:00:00.000Z',
          },
        ]}
        currentEmail="first@example.com"
        currentUserId="admin-1"
        operationalAlertRecipient={{
          userId: 'admin-1',
          email: 'first@example.com',
          source: 'default',
        }}
      />,
    );

    await userEvent.click(screen.getByLabelText('second@example.com'));
    await userEvent.click(screen.getByRole('button', { name: /Alarm-Empfänger speichern/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/operational-alerts',
      expect.objectContaining({ body: JSON.stringify({ userId: 'admin-2' }) }),
    );
  });
});
