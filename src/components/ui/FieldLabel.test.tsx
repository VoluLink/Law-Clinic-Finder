import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FieldLabel } from './FieldLabel';

type Props = Partial<Parameters<typeof FieldLabel>[0]>;

function renderLabel(props: Props = {}) {
  render(
    <>
      <FieldLabel htmlFor="f" label="Region" {...props} />
      <input id="f" />
    </>,
  );
}

describe('FieldLabel', () => {
  it('associates the label text with the field', () => {
    renderLabel();
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
  });

  it('shows a required marker without polluting the accessible name', () => {
    renderLabel({ required: true });
    expect(screen.getByText('*')).toBeInTheDocument();
    // The `*` is aria-hidden, so the field's accessible name stays exactly "Region".
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
  });

  it('renders the info hint when a hint is provided', () => {
    renderLabel({ hint: 'Hilfetext zur Region.' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hilfetext zur Region.');
  });

  it('omits the hint and required marker when the label is hidden', () => {
    renderLabel({ hint: 'Hilfe', required: true, labelHidden: true });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });
});
