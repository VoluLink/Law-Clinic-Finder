import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClinicsManager, type AdminClinicRow, type PendingSubmission } from './ClinicsManager';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function clinic(overrides: Partial<AdminClinicRow>): AdminClinicRow {
  return {
    id: 'c1',
    name: 'Mietrecht Clinic',
    description: null,
    region: 'Köln',
    contact_email: 'a@b.de',
    website: 'https://x.de',
    legal_areas: 'Mietrecht',
    target_clients: null,
    languages: null,
    requirements: null,
    advises_clients: true,
    is_published: true,
    accessState: 'active',
    lastSignInLabel: '1. Juli 2026',
    ...overrides,
  };
}

const active = clinic({ id: 'c1', name: 'Mietrecht Clinic', accessState: 'active' });
const noEmail = clinic({
  id: 'c2',
  name: 'Asyl Clinic',
  region: 'Berlin',
  contact_email: null,
  legal_areas: 'Asylrecht',
  accessState: 'no_email',
  is_published: false,
  lastSignInLabel: null,
});
const pending: PendingSubmission[] = [
  {
    id: 'p1',
    name: 'Neue Clinic',
    region: 'Hamburg',
    legal_areas: 'Sozialrecht',
    contact_email: 'n@c.de',
    submitted_at: '2026-07-01',
  },
];

function renderManager() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ClinicsManager clinics={[active, noEmail]} pending={pending} />);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('ClinicsManager', () => {
  it('renders the pending panel and per-state Zugang controls', () => {
    renderManager();
    expect(screen.getByText('Neue Einträge zur Prüfung')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zugang entziehen' })).toBeInTheDocument();
    expect(screen.getByText('Beratungsemail nötig')).toBeInTheDocument();
  });

  it('filters to clinics without access', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Kein Zugang' }));
    expect(screen.getByText('Asyl Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Mietrecht Clinic')).not.toBeInTheDocument();
  });

  it('filters to entries linked to an account, including invited-but-not-signed-in', async () => {
    const invited = clinic({ id: 'c3', name: 'Sozial Clinic', accessState: 'invited' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    render(<ClinicsManager clinics={[active, invited, noEmail]} pending={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mit Konto verknüpft' }));
    expect(screen.getByText('Mietrecht Clinic')).toBeInTheDocument();
    expect(screen.getByText('Sozial Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Asyl Clinic')).not.toBeInTheDocument();
  });

  it('switches cells to editable inputs in edit mode', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    expect(screen.getByDisplayValue('Mietrecht Clinic')).toBeInTheDocument();
  });

  it('renders content-typed inputs for website and email cells', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    expect(screen.getAllByDisplayValue('https://x.de')[0]).toHaveAttribute('type', 'url');
    expect(screen.getByDisplayValue('a@b.de')).toHaveAttribute('type', 'email');
  });

  it('renders a Ja/Nein control for the Beratungsarbeit cell', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const advice = screen.getAllByRole('combobox', { name: 'Berät individuell?' });
    expect((advice[0] as HTMLSelectElement).value).toBe('ja');
  });

  it('blocks publishing an incomplete draft and names the missing fields', async () => {
    const fetchMock = renderManager();
    // Asyl Clinic (draft) is missing Mandant:innen and Sprache.
    await userEvent.click(screen.getByRole('button', { name: 'Entwurf' }));
    expect(
      screen.getByText(/Zum Veröffentlichen fehlt noch:.*Mandant:innen.*Sprache/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('publishes a complete draft through the API', async () => {
    const complete = clinic({
      id: 'c9',
      name: 'Voll Clinic',
      is_published: false,
      target_clients: 'Studierende',
      languages: 'Deutsch',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClinicsManager clinics={[complete]} pending={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entwurf' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/clinics/c9',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_published: true }) }),
    );
  });

  it('renders guided chip and suggestion controls for category cells in edit mode', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    // legal_areas becomes a chip combobox carrying the stored value as a chip.
    expect(screen.getAllByRole('combobox', { name: 'Rechtsgebiet' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mietrecht entfernen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asylrecht entfernen' })).toBeInTheDocument();
    // region becomes a chip combobox carrying the city as a removable chip.
    expect(screen.getByRole('button', { name: 'Köln entfernen' })).toBeInTheDocument();
  });

  it('approves a pending submission via the API', async () => {
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Freischalten' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/submissions/p1', { method: 'POST' });
  });

  it('revokes access after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Zugang entziehen' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/clinics/c1/access', { method: 'DELETE' });
  });

  it('greys out the table-wide Speichern until a cell changes', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await userEvent.type(screen.getByDisplayValue('Mietrecht Clinic'), '!');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });

  it('saves only the changed rows through the API on Speichern', async () => {
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const nameCell = screen.getByDisplayValue('Mietrecht Clinic');
    await userEvent.clear(nameCell);
    await userEvent.type(nameCell, 'Neuer Name');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/clinics/c1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('blocks the save and names the clinic when a contact email is invalid', async () => {
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const emailCell = screen.getByDisplayValue('a@b.de');
    await userEvent.clear(emailCell);
    await userEvent.type(emailCell, 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/gültige E-Mail-Adresse ein: Mietrecht Clinic/)).toBeInTheDocument();
  });

  it('discards all edits and returns to the read view on the table-wide Abbrechen', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const nameCell = screen.getByDisplayValue('Mietrecht Clinic');
    await userEvent.clear(nameCell);
    await userEvent.type(nameCell, 'Geänderter Name');
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('button', { name: /Datenbank bearbeiten/ })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Geänderter Name')).not.toBeInTheDocument();
    expect(screen.getByText('Mietrecht Clinic')).toBeInTheDocument();
  });
});
