import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminChrome } from './AdminChrome';

const nav = vi.hoisted(() => ({ path: '/admin' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));

function renderAt(path: string) {
  nav.path = path;
  return render(
    <AdminChrome adminEmail="admin@example.com">
      <p>Seiteninhalt</p>
    </AdminChrome>,
  );
}

describe('AdminChrome', () => {
  it('shows the title for the active route', () => {
    renderAt('/admin/clinics');
    expect(screen.getByRole('heading', { name: 'Law-Clinics-Datenbank' })).toBeInTheDocument();
  });

  it('marks the matching nav link as the current page', () => {
    renderAt('/admin/logs');
    const link = screen.getAllByRole('link', { name: /Protokolle/ })[0];
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark the dashboard active on a sub-route', () => {
    renderAt('/admin/clinics');
    const dashboard = screen.getAllByRole('link', { name: /Dashboard/ })[0];
    expect(dashboard).not.toHaveAttribute('aria-current');
  });

  it('renders the admin email and the page content', () => {
    renderAt('/admin');
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Seiteninhalt')).toBeInTheDocument();
  });
});
