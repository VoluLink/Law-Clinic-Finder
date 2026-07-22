import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';

function renderOpen(onClose = vi.fn()) {
  render(
    <Drawer open onClose={onClose} title="Gesprächsverlauf" subtitle="16.07.2026">
      <p>Inhalt</p>
    </Drawer>,
  );
  return onClose;
}

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="X">
        <p>Inhalt</p>
      </Drawer>,
    );
    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument();
  });

  it('shows the title, subtitle and content when open', () => {
    renderOpen();
    expect(screen.getByRole('dialog', { name: 'Gesprächsverlauf' })).toBeInTheDocument();
    expect(screen.getByText('16.07.2026')).toBeInTheDocument();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('closes on the close button, the backdrop and Escape', async () => {
    const onClose = renderOpen();
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await userEvent.click(screen.getByTestId('drawer-backdrop'));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
