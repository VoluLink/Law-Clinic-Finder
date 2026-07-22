import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('associates the label with the switch', () => {
    render(<Toggle label="Chatbot aktiviert" />);
    expect(screen.getByLabelText('Chatbot aktiviert')).toBeInTheDocument();
  });

  it('reflects the checked state', () => {
    render(<Toggle label="Chatbot aktiviert" checked readOnly />);
    expect(screen.getByLabelText('Chatbot aktiviert')).toBeChecked();
  });

  it('flips the checked state when toggled, as a controlled input', () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <Toggle label="Chatbot aktiviert" checked={on} onChange={(e) => setOn(e.target.checked)} />
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Chatbot aktiviert');
    expect(input).not.toBeChecked();
    fireEvent.click(input);
    expect(input).toBeChecked();
  });
});
