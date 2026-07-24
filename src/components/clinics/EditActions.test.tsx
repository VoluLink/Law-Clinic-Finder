import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditActions } from './EditActions';

describe('EditActions', () => {
  it('disables Speichern while nothing has changed', () => {
    render(<EditActions dirty={false} onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('enables Speichern once there are changes', () => {
    render(<EditActions dirty onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('calls onCancel when Abbrechen is clicked', async () => {
    const onCancel = vi.fn();
    render(<EditActions dirty onCancel={onCancel} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables both buttons while busy, even with changes', () => {
    render(<EditActions dirty busy onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
  });

  it('renders Speichern as a submit control when saveType is submit', () => {
    render(<EditActions dirty saveType="submit" onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute('type', 'submit');
  });
});
