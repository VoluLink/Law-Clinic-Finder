import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InfoHint } from './InfoHint';

const HELP = 'Die Stadt oder Region, in der die Clinic tätig ist.';

describe('InfoHint', () => {
  it('exposes the explainer as the tooltip text', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);
  });

  it('names the trigger after the field it explains', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('button', { name: 'Erklärung zu Region' })).toBeInTheDocument();
  });

  it('describes the trigger with the explainer for assistive tech', () => {
    render(<InfoHint text={HELP} label="Region" />);
    expect(screen.getByRole('button')).toHaveAccessibleDescription(HELP);
  });
});
