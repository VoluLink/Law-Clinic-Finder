import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SuggestInput } from './SuggestInput';

const SUGGESTIONS = ['Deutschlandweit', 'Berlin', 'Hamburg'];

describe('SuggestInput', () => {
  it('associates the label with the input', () => {
    render(<SuggestInput label="Region" value="" onChange={vi.fn()} suggestions={SUGGESTIONS} />);
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
  });

  it('offers every suggestion via a datalist', () => {
    render(<SuggestInput label="Region" value="" onChange={vi.fn()} suggestions={SUGGESTIONS} />);
    const input = screen.getByLabelText('Region');
    const listId = input.getAttribute('list');
    const datalist = document.getElementById(listId ?? '');
    expect(datalist?.querySelectorAll('option')).toHaveLength(SUGGESTIONS.length);
  });

  it('passes free-typed text straight through to onChange', async () => {
    const onChange = vi.fn();
    render(<SuggestInput label="Region" value="" onChange={onChange} suggestions={SUGGESTIONS} />);
    await userEvent.type(screen.getByLabelText('Region'), 'X');
    expect(onChange).toHaveBeenLastCalledWith('X');
  });

  it('renders the current value', () => {
    render(
      <SuggestInput label="Region" value="Leipzig" onChange={vi.fn()} suggestions={SUGGESTIONS} />,
    );
    expect(screen.getByLabelText('Region')).toHaveValue('Leipzig');
  });

  it('shows the error message when provided', () => {
    render(
      <SuggestInput
        label="Region"
        value=""
        onChange={vi.fn()}
        suggestions={SUGGESTIONS}
        error="Pflichtfeld"
      />,
    );
    expect(screen.getByText('Pflichtfeld')).toBeInTheDocument();
  });
});
