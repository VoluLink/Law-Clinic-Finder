import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Mietrecht</Badge>);
    expect(screen.getByText('Mietrecht')).toBeInTheDocument();
  });

  it('applies the primary variant classes when requested', () => {
    render(<Badge variant="primary">Neu</Badge>);
    expect(screen.getByText('Neu').className).toContain('bg-primary');
  });

  it('applies the success variant classes when requested', () => {
    render(<Badge variant="success">bereits aktiv</Badge>);
    expect(screen.getByText('bereits aktiv').className).toContain('bg-success-surface');
  });
});
