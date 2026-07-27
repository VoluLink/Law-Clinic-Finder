import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarChart } from './BarChart';

const bars = [
  { label: 'W1', value: 2 },
  { label: 'W2', value: 6 },
];

describe('BarChart', () => {
  it('renders one labelled bar per datum', () => {
    render(<BarChart bars={bars} />);
    expect(screen.getByText('W1')).toBeInTheDocument();
    expect(screen.getByLabelText('W2: 6')).toBeInTheDocument();
  });

  it('scales bar height relative to the maximum value', () => {
    render(<BarChart bars={bars} />);
    expect(screen.getByLabelText('W1: 2')).toHaveStyle({ height: `${(2 / 6) * 100}%` });
  });

  it('renders every count as visible text', () => {
    render(<BarChart bars={bars} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('paints the most recent bar in the primary petrol', () => {
    render(<BarChart bars={bars} />);
    expect(screen.getByLabelText('W2: 6')).toHaveClass('bg-primary');
  });
});
