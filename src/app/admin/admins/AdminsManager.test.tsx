import { render, screen } from '@testing-library/react';
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
      />,
    );

    expect(screen.getByText('Admin-E-Mail-Adresse')).toBeInTheDocument();
  });

  it('leaves the notification recipient to the Benachrichtigungen screen', () => {
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
      />,
    );

    expect(screen.queryByText('Admin-Benachrichtigungen')).not.toBeInTheDocument();
  });
});
