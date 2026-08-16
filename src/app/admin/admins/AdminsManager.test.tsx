import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminsManager } from './AdminsManager';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('AdminsManager', () => {
  it('groups the current admin email settings with admin management', () => {
    render(
      <AdminsManager
        admins={[{ userId: 'admin-1', email: 'admin@example.com', status: 'active' }]}
        currentEmail="admin@example.com"
        currentUserId="admin-1"
      />,
    );

    expect(screen.getByText('Admin-E-Mail-Adresse')).toBeInTheDocument();
  });
});
