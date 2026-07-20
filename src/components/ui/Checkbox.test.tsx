import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('associates the label with the checkbox', () => {
    render(<Checkbox label="Veröffentlicht" />);
    expect(screen.getByLabelText('Veröffentlicht')).toBeInTheDocument();
  });

  it('reflects the checked state', () => {
    render(<Checkbox label="Veröffentlicht" checked readOnly />);
    expect(screen.getByLabelText('Veröffentlicht')).toBeChecked();
  });
});
