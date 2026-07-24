import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ClinicEditable } from '@/lib/clinics/schema';

import { ClinicForm } from './ClinicForm';

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

describe('ClinicForm', () => {
  it('shows the entry read-only with an edit button by default', () => {
    render(<ClinicForm clinic={clinic} />);
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Legal Clinic Berlin')).toBeInTheDocument();
  });

  it('reveals editable inputs with Speichern and Abbrechen after clicking edit', () => {
    render(<ClinicForm clinic={clinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Legal Clinic Berlin');
  });

  it('greys out Speichern until a field is changed', () => {
    render(<ClinicForm clinic={clinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Geändert' } });
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('discards edits and returns to the read view on Abbrechen', () => {
    render(<ClinicForm clinic={clinic} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Geändert' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByText('Geändert')).not.toBeInTheDocument();
    expect(screen.getByText('Legal Clinic Berlin')).toBeInTheDocument();
  });
});
