import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Titel">
        Inhalt
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Titel">
        Inhalt
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Titel' })).toBeInTheDocument();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titel">
        Inhalt
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titel">
        Inhalt
      </Modal>,
    );
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titel">
        Inhalt
      </Modal>,
    );
    await userEvent.click(screen.getByText('Inhalt'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
