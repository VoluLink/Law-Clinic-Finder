import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label, value and hint', () => {
    render(<StatCard label="KI-Interaktionen" value="1.294" hint="Chat-Suchen" />);
    expect(screen.getByText('KI-Interaktionen')).toBeInTheDocument();
    expect(screen.getByText('1.294')).toBeInTheDocument();
    expect(screen.getByText('Chat-Suchen')).toBeInTheDocument();
  });

  it('uses the petrol background for the dark tone', () => {
    const { container } = render(<StatCard label="API-Kosten" value="€ 0" tone="dark" />);
    expect(container.firstChild).toHaveClass('bg-primary');
  });

  it('colors an upward hint with the strong success green', () => {
    render(<StatCard label="Nutzer" value="10" hint="▲ 12 %" hintTone="up" />);
    expect(screen.getByText('▲ 12 %')).toHaveClass('text-success-strong');
  });
});
