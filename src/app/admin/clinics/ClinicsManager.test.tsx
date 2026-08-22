import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClinicsManager, type AdminClinicRow, type PendingReview } from './ClinicsManager';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const MAILED_ID = '3f1c1a4e-2f4a-4f2b-9d9e-6a3c0b7f5d21';
const OTHER_ID = 'b7d2c5a1-9e14-4a63-8f0d-2c6b41e7a9f8';

function clinic(overrides: Partial<AdminClinicRow>): AdminClinicRow {
  return {
    id: 'c1',
    name: 'Mietrecht Clinic',
    description: null,
    region: 'Köln',
    contact_email: 'alpha@example.org',
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
const pending: PendingReview[] = [
  {
    id: 'p1',
    name: 'Neue Clinic',
    region: 'Hamburg',
    legal_areas: 'Sozialrecht',
    contact_email: 'new@example.org',
    kind: 'new',
  },
];

function renderManager() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ClinicsManager clinics={[active, noEmail]} pending={pending} />);
  return fetchMock;
}

afterEach(() => {
  searchParams.delete('clinic');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDeepLinked(clinicParam: string) {
  searchParams.set('clinic', clinicParam);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  const mailed = clinic({ id: MAILED_ID, name: 'Verlinkte Clinic' });
  const other = clinic({ id: OTHER_ID, name: 'Andere Clinic' });
  render(<ClinicsManager clinics={[other, mailed]} pending={[]} />);
}

function rowOf(name: string): HTMLElement | null {
  return screen.getByText(name).closest('tr');
}

describe('ClinicsManager', () => {
  it('renders the pending panel and per-state Zugang controls', () => {
    renderManager();
    expect(screen.getByText('Zugänge zur Prüfung')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zugang zurücksetzen' })).toBeInTheDocument();
    expect(screen.getByText('Beratungsemail nötig')).toBeInTheDocument();
  });

  it('freezes the header row and the Name column for scrolling', () => {
    renderManager();
    const scroller = screen.getByRole('table').parentElement;
    expect(scroller).toHaveClass('overflow-auto', 'max-h-[70vh]');
    // The first column header (Name) is pinned both vertically and horizontally.
    const nameHeader = screen.getAllByRole('columnheader')[0];
    expect(nameHeader.className).toContain('sticky');
    expect(nameHeader.className).toContain('left-0');
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
    expect(screen.getByDisplayValue('alpha@example.org')).toHaveAttribute('type', 'email');
  });

  it('renders a Ja/Nein control for the Beratungsarbeit cell', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const advice = screen.getAllByRole('combobox', { name: 'Berät individuell?' });
    expect((advice[0] as HTMLSelectElement).value).toBe('ja');
  });

  it('disables the publish switch for an incomplete draft and explains why', () => {
    const fetchMock = renderManager();
    // Asyl Clinic (draft) is missing Mandant:innen and Sprache.
    expect(screen.getByRole('checkbox', { name: /Entwurf/ })).toBeDisabled();
    expect(
      screen.getByText(/Zum Veröffentlichen fehlt noch:.*Mandant:innen.*Sprache/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks a blocked publish switch with the Font Awesome warning triangle', () => {
    renderManager();
    const warning = screen.getByRole('button', { name: 'Erklärung zu Veröffentlichung' });
    expect(warning.querySelector('svg')).toHaveAttribute('viewBox', '0 0 640 640');
  });

  it('publishes a complete draft when its switch is toggled on', async () => {
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
    const toggle = screen.getByRole('checkbox', { name: /Entwurf/ });
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/clinics/c9',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_published: true }) }),
    );
  });

  it('hides a published clinic when its switch is toggled off', async () => {
    const published = clinic({ id: 'c8', name: 'Sichtbar Clinic', is_published: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClinicsManager clinics={[published]} pending={[]} />);
    const toggle = screen.getByRole('checkbox', { name: /Veröffentlicht/ });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/clinics/c8',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_published: false }) }),
    );
  });

  it('lets the admin unpublish a clinic while the database is in edit mode', async () => {
    const published = clinic({ id: 'c8', name: 'Sichtbar Clinic', is_published: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClinicsManager clinics={[published]} pending={[]} />);
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const toggle = screen.getByRole('checkbox', { name: /Veröffentlicht/ });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/clinics/c8',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_published: false }) }),
    );
  });

  it('gates the edit-mode publish switch on the saved row, not unsaved draft edits', async () => {
    // Only "Homepage" is missing, so publishing stays blocked until it is saved.
    const onlyWebsiteMissing = clinic({
      id: 'c7',
      name: 'Fast Clinic',
      is_published: false,
      website: null,
      target_clients: 'Studierende',
      languages: 'Deutsch',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    render(<ClinicsManager clinics={[onlyWebsiteMissing]} pending={[]} />);
    await userEvent.click(screen.getByRole('button', { name: /Datenbank bearbeiten/ }));
    const toggle = screen.getByRole('checkbox', { name: /Entwurf/ });
    expect(toggle).toBeDisabled();
    // Filling Homepage in the draft must NOT enable publishing — the server
    // validates the stored row, which stays incomplete until Speichern.
    await userEvent.type(screen.getByRole('textbox', { name: 'Homepage' }), 'https://neu.de');
    expect(toggle).toBeDisabled();
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

  it('opens a confirmation dialog before resetting access', async () => {
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Zugang zurücksetzen' }));
    expect(screen.getByRole('dialog', { name: 'Zugang zurücksetzen?' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resets access after confirmation in the dialog', async () => {
    const fetchMock = renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Zugang zurücksetzen' }));
    const dialog = screen.getByRole('dialog', { name: 'Zugang zurücksetzen?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zugang zurücksetzen' }));
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
    const emailCell = screen.getByDisplayValue('alpha@example.org');
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

  it('opens and scrolls to the clinic named by a valid ?clinic= link', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderDeepLinked(MAILED_ID);
    expect(rowOf('Verlinkte Clinic')).toHaveAttribute('aria-current', 'true');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('leaves every row closed when ?clinic= is malformed', () => {
    renderDeepLinked('not-a-uuid');
    expect(rowOf('Verlinkte Clinic')).not.toHaveAttribute('aria-current');
    expect(rowOf('Andere Clinic')).not.toHaveAttribute('aria-current');
  });

  it('falls back to the plain list when the linked clinic is gone', () => {
    renderDeepLinked('0a5f6c31-8b2d-4c77-9a10-5e8f3d21b604');
    expect(screen.getByText('Verlinkte Clinic')).toBeInTheDocument();
    expect(rowOf('Verlinkte Clinic')).not.toHaveAttribute('aria-current');
  });

  it('keeps the row the admin opens afterwards instead of the linked one', async () => {
    renderDeepLinked(MAILED_ID);
    await userEvent.click(screen.getByText('Andere Clinic'));
    expect(rowOf('Andere Clinic')).toHaveAttribute('aria-current', 'true');
    expect(rowOf('Verlinkte Clinic')).not.toHaveAttribute('aria-current');
  });
});
