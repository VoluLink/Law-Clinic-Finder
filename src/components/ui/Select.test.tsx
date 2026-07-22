import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const options = [
  { value: 'all', label: 'Alle' },
  { value: 'error', label: 'error' },
];

describe('Select', () => {
  it('renders the label and options', () => {
    render(<Select label="Level" options={options} />);
    expect(screen.getByLabelText('Level')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'error' })).toBeInTheDocument();
  });

  it('reports the chosen value to onChange', async () => {
    const onChange = vi.fn();
    render(<Select label="Level" options={options} value="all" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'error');
    expect(onChange).toHaveBeenCalled();
  });
});
