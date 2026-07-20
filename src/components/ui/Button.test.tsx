import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Speichern</Button>);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it never submits forms accidentally', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('applies the primary variant classes by default', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button').className).toContain('bg-primary');
  });

  it('applies the danger variant classes when requested', () => {
    render(<Button variant="danger">Löschen</Button>);
    expect(screen.getByRole('button').className).toContain('bg-danger');
  });

  it('applies the accent variant classes when requested', () => {
    render(<Button variant="accent">Neue Law Clinic eintragen</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');
  });

  it('is rectangular by default', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-lg');
  });

  it('is fully rounded with the pill shape', () => {
    render(<Button shape="pill">Das ist meine</Button>);
    const className = screen.getByRole('button').className;
    expect(className).toContain('rounded-full');
    expect(className).not.toContain('rounded-lg');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Ok
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
