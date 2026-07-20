import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('associates the label with the textarea', () => {
    render(<Textarea label="Rechtsgebiete" name="legal_areas" />);
    expect(screen.getByLabelText('Rechtsgebiete')).toBeInTheDocument();
  });

  it('shows the error message when given', () => {
    render(<Textarea label="Rechtsgebiete" name="legal_areas" error="Pflichtfeld" />);
    expect(screen.getByText('Pflichtfeld')).toBeInTheDocument();
  });

  it('marks the textarea invalid when an error is given', () => {
    render(<Textarea label="Rechtsgebiete" name="legal_areas" error="Pflichtfeld" />);
    expect(screen.getByLabelText('Rechtsgebiete')).toHaveAttribute('aria-invalid', 'true');
  });
});
