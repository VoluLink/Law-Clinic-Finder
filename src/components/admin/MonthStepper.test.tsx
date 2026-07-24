import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthStepper } from './MonthStepper';

// Standing in October 2027, statistics reach back to October 2026 (see month-window).
const OCT_2027 = Date.UTC(2027, 9, 15, 12, 0, 0);

describe('MonthStepper', () => {
  it('renders the German month label for the selected month', () => {
    render(<MonthStepper month="2027-03" now={OCT_2027} />);
    expect(screen.getByText('März 2027')).toBeInTheDocument();
  });

  it('links each arrow to the adjacent month', () => {
    render(<MonthStepper month="2027-03" now={OCT_2027} />);
    expect(screen.getByRole('link', { name: 'Vorheriger Monat' })).toHaveAttribute(
      'href',
      '?month=2027-02',
    );
    expect(screen.getByRole('link', { name: 'Nächster Monat' })).toHaveAttribute(
      'href',
      '?month=2027-04',
    );
  });

  it('disables the previous arrow at the oldest retained month', () => {
    render(<MonthStepper month="2026-10" now={OCT_2027} />);
    expect(screen.queryByRole('link', { name: 'Vorheriger Monat' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Nächster Monat' })).toBeInTheDocument();
  });

  it('disables the next arrow in the current month', () => {
    render(<MonthStepper month="2027-10" now={OCT_2027} />);
    expect(screen.queryByRole('link', { name: 'Nächster Monat' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Vorheriger Monat' })).toBeInTheDocument();
  });
});
