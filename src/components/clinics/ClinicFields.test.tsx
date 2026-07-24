import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ClinicEditable } from '@/lib/clinics/schema';

import { ClinicFields } from './ClinicFields';

const clinic: ClinicEditable = {
  name: 'Legal Clinic Berlin',
  description: 'Wir beraten.',
  region: 'Bundesweit',
  contact_email: 'kontakt@example.org',
  website: 'https://example.org',
  legal_areas: 'Mietrecht; Arbeitsrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch; Englisch',
  requirements: null,
  advises_clients: true,
};

describe('ClinicFields readOnly', () => {
  it('renders values as static text, not editable inputs', () => {
    render(<ClinicFields value={clinic} onChange={vi.fn()} readOnly />);
    expect(screen.getByText('Legal Clinic Berlin')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a dash for the one empty field', () => {
    render(<ClinicFields value={clinic} onChange={vi.fn()} readOnly />);
    expect(screen.getAllByText('—')).toHaveLength(1);
  });

  it('renders each multi-value item as its own entry', () => {
    render(<ClinicFields value={clinic} onChange={vi.fn()} readOnly />);
    expect(screen.getByText('Mietrecht')).toBeInTheDocument();
    expect(screen.getByText('Arbeitsrecht')).toBeInTheDocument();
  });
});

describe('ClinicFields editable', () => {
  it('constrains the contact email field to email input', () => {
    render(<ClinicFields value={clinic} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Beratungsemail (zugleich Anmelde-Adresse)')).toHaveAttribute(
      'type',
      'email',
    );
  });

  it('edits region as a chip combobox and surfaces field hints', () => {
    render(<ClinicFields value={clinic} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Region / Stadt' })).toBeInTheDocument();
    expect(screen.getByText(/Die Stadt und\/oder Region/)).toBeInTheDocument();
  });
});
