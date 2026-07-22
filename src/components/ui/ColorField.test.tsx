import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ColorField } from './ColorField';

describe('ColorField', () => {
  it('renders the label and shows the hex value', () => {
    render(<ColorField label="Primär" value="#0d4b5b" onChange={vi.fn()} />);
    expect(screen.getByText('Primär')).toBeInTheDocument();
    expect(screen.getByLabelText('Primär Hex')).toHaveValue('#0d4b5b');
  });

  it('reports edits to onChange', async () => {
    const onChange = vi.fn();
    render(<ColorField label="Primär" value="#0d4b5b" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Primär Hex'), '0');
    expect(onChange).toHaveBeenCalled();
  });
});
