import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Inhalt</Card>);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('merges a custom className', () => {
    render(<Card className="mt-2">Inhalt</Card>);
    expect(screen.getByText('Inhalt').className).toContain('mt-2');
  });

  it('applies the lifted panel shape when requested', () => {
    render(<Card variant="panel">Inhalt</Card>);
    const className = screen.getByText('Inhalt').className;
    expect(className).toContain('rounded-3xl');
    expect(className).toContain('shadow-panel');
  });
});
