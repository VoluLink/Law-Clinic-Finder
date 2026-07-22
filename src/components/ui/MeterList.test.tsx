import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MeterList } from './MeterList';

const rows = [
  { label: 'Mietrecht', value: '12', percent: 60 },
  { label: 'Asylrecht', value: '8', percent: 40 },
];

describe('MeterList', () => {
  it('renders each row label and value', () => {
    render(<MeterList rows={rows} />);
    expect(screen.getByText('Mietrecht')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('sets the fill width from the percent and caps it at 100', () => {
    const { container } = render(<MeterList rows={[{ label: 'x', value: '1', percent: 150 }]} />);
    const fill = container.querySelector('.rounded-full > .rounded-full') as HTMLElement;
    expect(fill).toHaveStyle({ width: '100%' });
  });
});
