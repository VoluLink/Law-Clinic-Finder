import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="Stadt" name="city" />);
    expect(screen.getByLabelText('Stadt')).toBeInTheDocument();
  });

  it('shows the error message when given', () => {
    render(<Input label="Stadt" name="city" error="Pflichtfeld" />);
    expect(screen.getByText('Pflichtfeld')).toBeInTheDocument();
  });

  it('marks the input invalid when an error is given', () => {
    render(<Input label="Stadt" name="city" error="Pflichtfeld" />);
    expect(screen.getByLabelText('Stadt')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is not marked invalid without an error', () => {
    render(<Input label="Stadt" name="city" />);
    expect(screen.getByLabelText('Stadt')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the field reachable by name when the label is visually hidden', () => {
    render(<Input label="Name der Law Clinic" name="query" labelHidden />);
    expect(screen.getByLabelText('Name der Law Clinic')).toBeInTheDocument();
  });

  it('hides the label visually only when asked', () => {
    const { rerender } = render(<Input label="Stadt" name="city" />);
    expect(screen.getByText('Stadt').className).not.toContain('sr-only');
    rerender(<Input label="Stadt" name="city" labelHidden />);
    expect(screen.getByText('Stadt').className).toContain('sr-only');
  });

  it('renders a leading icon alongside the field', () => {
    render(<Input label="Stadt" name="city" leadingIcon={<svg data-testid="magnifier" />} />);
    expect(screen.getByTestId('magnifier')).toBeInTheDocument();
  });

  it('is fully rounded with the pill shape', () => {
    render(<Input label="Stadt" name="city" shape="pill" />);
    expect(screen.getByLabelText('Stadt').className).toContain('rounded-full');
  });
});
