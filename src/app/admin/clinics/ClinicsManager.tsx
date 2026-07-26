'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EditActions } from '@/components/clinics/EditActions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InfoHint } from '@/components/ui/InfoHint';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import type { AccessState } from '@/lib/admin/clinic-access';
import { FIELD_HELP } from '@/lib/clinics/field-help';
import { LANGUAGES, LEGAL_AREAS, REGION_SUGGESTIONS, TARGET_GROUPS } from '@/lib/clinics/options';
import {
  publishBlockers,
  PUBLISH_KEYS,
  toRequiredLabels,
} from '@/lib/clinics/publish-requirements';
import { cn } from '@/lib/cn';
import { isValidEmail } from '@/lib/forms/email';

export type AdminClinicRow = {
  id: string;
  name: string;
  description: string | null;
  region: string | null;
  contact_email: string | null;
  website: string | null;
  legal_areas: string;
  target_clients: string | null;
  languages: string | null;
  requirements: string | null;
  advises_clients: boolean;
  is_published: boolean;
  accessState: AccessState;
  lastSignInLabel: string | null;
};

export type PendingSubmission = {
  id: string;
  name: string;
  region: string | null;
  legal_areas: string;
  contact_email: string;
  submitted_at: string;
};

type EditableKey =
  | 'name'
  | 'website'
  | 'contact_email'
  | 'advises_clients'
  | 'description'
  | 'region'
  | 'legal_areas'
  | 'target_clients'
  | 'languages'
  | 'requirements';

type CellValue = string | boolean;

/** Category columns that get the chip combobox; the rest stay free-text. */
const MULTI_SUGGESTIONS: Partial<Record<EditableKey, readonly string[]>> = {
  region: REGION_SUGGESTIONS,
  legal_areas: LEGAL_AREAS,
  target_clients: TARGET_GROUPS,
  languages: LANGUAGES,
};

/** Columns an admin must fill before a clinic can be published (marked with `*`). */
const PUBLISH_REQUIRED = new Set<string>(PUBLISH_KEYS);

// Frozen-cell classes for the wide database table: the header row stays put on
// vertical scroll, the Name column on horizontal scroll, so the admin never loses
// the headings or which clinic a row belongs to. bg-surface keeps frozen cells
// opaque; z-order is corner (Name header) > header row > Name column. The wrapper
// isolates these z-indexes from the surrounding portal chrome.
const CELL_BORDER = 'border-b border-border group-last:border-b-0';
const STICKY_HEAD = 'sticky top-0 z-20 bg-surface';
const STICKY_NAME_HEAD = 'sticky top-0 left-0 z-30 border-e border-border bg-surface';
const STICKY_NAME_CELL = 'sticky left-0 z-10 border-e border-border bg-surface';

const COLUMNS: Array<{ key: EditableKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'website', label: 'Homepage' },
  { key: 'contact_email', label: 'Beratungsemail' },
  { key: 'advises_clients', label: 'Berät individuell?' },
  { key: 'description', label: 'Beratungsarbeit' },
  { key: 'region', label: 'Region' },
  { key: 'legal_areas', label: 'Rechtsgebiet' },
  { key: 'target_clients', label: 'Mandant*innen' },
  { key: 'languages', label: 'Sprache' },
  { key: 'requirements', label: 'Andere Voraussetzungen' },
];

const FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'linked', label: 'Mit Konto verknüpft' },
  { key: 'active', label: 'Zugang aktiv' },
  { key: 'invited', label: 'Einladung offen' },
  { key: 'none', label: 'Kein Zugang' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

function matchesSearch(clinic: AdminClinicRow, term: string): boolean {
  if (!term) return true;
  const haystack = `${clinic.name} ${clinic.region ?? ''} ${clinic.legal_areas}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function matchesFilter(clinic: AdminClinicRow, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return clinic.accessState === 'none' || clinic.accessState === 'no_email';
  // A linked entry has a member login — whether or not they have signed in yet.
  if (filter === 'linked')
    return clinic.accessState === 'active' || clinic.accessState === 'invited';
  return clinic.accessState === filter;
}

function editablePayload(row: AdminClinicRow): Pick<AdminClinicRow, EditableKey> {
  const keys = COLUMNS.map((column) => column.key);
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<
    AdminClinicRow,
    EditableKey
  >;
}

export function ClinicsManager({
  clinics,
  pending,
}: {
  clinics: AdminClinicRow[];
  pending: PendingSubmission[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [drafts, setDrafts] = useState<Record<string, AdminClinicRow>>({});
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [resetClinic, setResetClinic] = useState<AdminClinicRow | null>(null);
  const [resettingAccess, setResettingAccess] = useState(false);

  async function call(url: string, init: RequestInit, okMessage: string) {
    setStatus('');
    const response = await fetch(url, init).catch(() => null);
    setStatus(response && response.ok ? okMessage : 'Aktion fehlgeschlagen.');
    router.refresh();
  }

  const patch = (body: unknown): RequestInit => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  function setCell(id: string, key: EditableKey, value: CellValue) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  function changedClinics(): AdminClinicRow[] {
    return clinics.filter(
      (c) =>
        JSON.stringify(editablePayload(drafts[c.id] ?? c)) !== JSON.stringify(editablePayload(c)),
    );
  }

  async function saveAll() {
    const changed = changedClinics();
    if (changed.length === 0) return;
    const badEmails = changed.filter((c) => {
      const email = (drafts[c.id] ?? c).contact_email;
      return !!email && !isValidEmail(email);
    });
    if (badEmails.length > 0) {
      setStatus(
        `Bitte gib eine gültige E-Mail-Adresse ein: ${badEmails.map((c) => c.name).join(', ')}.`,
      );
      return;
    }
    setSaving(true);
    setStatus('');
    const results = await Promise.all(
      changed.map((c) =>
        fetch(`/api/admin/clinics/${c.id}`, patch(editablePayload(drafts[c.id] ?? c))).catch(
          () => null,
        ),
      ),
    );
    setSaving(false);
    const allOk = results.every((response) => response?.ok);
    setStatus(allOk ? 'Gespeichert.' : 'Einige Änderungen konnten nicht gespeichert werden.');
    if (allOk) {
      setDrafts({});
      setEditing(false);
    }
    router.refresh();
  }

  function cancelAll() {
    setDrafts({});
    setStatus('');
    setEditing(false);
  }

  const hasChanges = editing && changedClinics().length > 0;

  // The publish switch is disabled when the saved row is incomplete (PublishToggle
  // names what's missing), so this only runs for allowed flips; the server re-checks.
  // publishingId disables the row's switch while the PATCH is in flight.
  async function togglePublish(clinic: AdminClinicRow) {
    setPublishingId(clinic.id);
    await call(
      `/api/admin/clinics/${clinic.id}`,
      patch({ is_published: !clinic.is_published }),
      clinic.is_published ? 'Auf Entwurf gesetzt.' : 'Veröffentlicht.',
    );
    setPublishingId(null);
  }

  async function confirmAccessReset() {
    if (!resetClinic) return;
    setResettingAccess(true);
    await call(
      `/api/admin/clinics/${resetClinic.id}/access`,
      { method: 'DELETE' },
      'Zugang zurückgesetzt.',
    );
    setResettingAccess(false);
    setResetClinic(null);
  }

  const filtered = clinics.filter((c) => matchesSearch(c, search) && matchesFilter(c, filter));

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <PendingPanel
          pending={pending}
          onApprove={(id) =>
            call(`/api/admin/submissions/${id}`, { method: 'POST' }, 'Freigeschaltet.')
          }
          onReject={(id) =>
            window.confirm('Einreichung ablehnen?') &&
            call(`/api/admin/submissions/${id}`, { method: 'DELETE' }, 'Abgelehnt.')
          }
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[240px]">
            <Input
              label="Law Clinics durchsuchen"
              labelHidden
              placeholder="Nach Name, Region oder Rechtsgebiet suchen…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              shape="pill"
              variant={filter === option.key ? 'primary' : 'secondary'}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {editing ? (
          <EditActions dirty={hasChanges} busy={saving} onSave={saveAll} onCancel={cancelAll} />
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setDrafts(Object.fromEntries(clinics.map((c) => [c.id, { ...c }])));
              setEditing(true);
            }}
          >
            ✎ Datenbank bearbeiten
          </Button>
        )}
      </div>

      {status && (
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      )}

      {filtered.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">Keine Law Clinics gefunden.</p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-soft">
            <span className="text-danger">*</span> Pflichtfeld zum Veröffentlichen
          </p>
          <div className="isolate max-h-[70vh] overflow-auto rounded-[16px] border border-border bg-surface">
            <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-bold tracking-wide text-muted-soft uppercase">
                  {COLUMNS.map((column) => {
                    const help = FIELD_HELP[column.key];
                    return (
                      <th
                        key={column.key}
                        className={cn(
                          'border-b border-border p-3 text-start font-bold',
                          column.key === 'name' ? STICKY_NAME_HEAD : STICKY_HEAD,
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span>
                            {column.label}
                            {PUBLISH_REQUIRED.has(column.key) && (
                              <>
                                <span className="text-danger" aria-hidden>
                                  {' '}
                                  *
                                </span>
                                <span className="sr-only"> (Pflichtfeld)</span>
                              </>
                            )}
                          </span>
                          {help && <InfoHint text={help} label={column.label} />}
                        </span>
                      </th>
                    );
                  })}
                  <th
                    className={cn('border-b border-border p-3 text-start font-bold', STICKY_HEAD)}
                  >
                    Zugang
                  </th>
                  <th
                    className={cn('border-b border-border p-3 text-start font-bold', STICKY_HEAD)}
                  >
                    Status
                  </th>
                  {editing && (
                    <th
                      className={cn('border-b border-border p-3 text-start font-bold', STICKY_HEAD)}
                    >
                      Aktionen
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((clinic) => (
                  <ClinicRow
                    key={clinic.id}
                    clinic={clinic}
                    draft={editing ? (drafts[clinic.id] ?? clinic) : clinic}
                    editing={editing}
                    publishBusy={publishingId === clinic.id}
                    onCell={(key, value) => setCell(clinic.id, key, value)}
                    onDelete={() =>
                      window.confirm('Diese Law Clinic löschen?') &&
                      call(`/api/admin/clinics/${clinic.id}`, { method: 'DELETE' }, 'Gelöscht.')
                    }
                    onTogglePublish={() => togglePublish(clinic)}
                    onInvite={() =>
                      call(
                        `/api/admin/clinics/${clinic.id}/invite`,
                        { method: 'POST' },
                        'Einladung gesendet.',
                      )
                    }
                    onResetAccess={() => setResetClinic(clinic)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={resetClinic !== null}
        onClose={() => !resettingAccess && setResetClinic(null)}
        title="Zugang zurücksetzen?"
      >
        <p className="text-sm text-muted">
          Der Login und die Beratungsemail von {resetClinic?.name} werden entfernt. Der
          Veröffentlichungsstatus des Eintrags bleibt unverändert.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setResetClinic(null)}
            disabled={resettingAccess}
          >
            Abbrechen
          </Button>
          <Button variant="danger" onClick={confirmAccessReset} disabled={resettingAccess}>
            {resettingAccess ? 'Wird zurückgesetzt…' : 'Zugang zurücksetzen'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

type RowActions = {
  onCell: (key: EditableKey, value: CellValue) => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onInvite: () => void;
  onResetAccess: () => void;
};

function PublishToggle({
  clinic,
  busy,
  onToggle,
}: {
  clinic: AdminClinicRow;
  busy: boolean;
  onToggle: () => void;
}) {
  const missing = clinic.is_published ? [] : toRequiredLabels(publishBlockers(clinic));
  const blocked = missing.length > 0;
  const label = clinic.is_published ? 'Veröffentlicht' : 'Entwurf';
  return (
    <div className="flex items-center gap-2">
      <Toggle
        label={label}
        // Unique per row, and keeps the visible label inside the accessible name (WCAG 2.5.3).
        aria-label={`${label} – ${clinic.name}`}
        checked={clinic.is_published}
        disabled={blocked || busy}
        onChange={onToggle}
      />
      {blocked && (
        <InfoHint
          label="Veröffentlichung"
          text={`Zum Veröffentlichen fehlt noch: ${missing.join(', ')}.`}
          variant="warning"
        />
      )}
    </div>
  );
}

function ClinicRow({
  clinic,
  draft,
  editing,
  publishBusy,
  ...actions
}: {
  clinic: AdminClinicRow;
  draft: AdminClinicRow;
  editing: boolean;
  publishBusy: boolean;
} & RowActions) {
  // `draft` drives the editable cells; `clinic` (the saved row) drives publish and
  // access, so a toggle reflects — and is gated by — persisted state, not an
  // unsaved draft. Save first, then publish; the server validates the stored row.
  return (
    <tr className="group align-top">
      {COLUMNS.map((column) => (
        <td
          key={column.key}
          className={cn(
            CELL_BORDER,
            'min-w-[150px] p-3',
            column.key === 'name' && STICKY_NAME_CELL,
          )}
        >
          {editing ? (
            <EditCell
              columnKey={column.key}
              label={column.label}
              clinic={draft}
              onChange={(value) => actions.onCell(column.key, value)}
            />
          ) : (
            <ReadCell column={column.key} clinic={draft} />
          )}
        </td>
      ))}
      <td className={cn(CELL_BORDER, 'min-w-[190px] p-3')}>
        <ZugangCell
          clinic={clinic}
          onInvite={actions.onInvite}
          onResetAccess={actions.onResetAccess}
        />
      </td>
      <td className={cn(CELL_BORDER, 'p-3')}>
        <PublishToggle clinic={clinic} busy={publishBusy} onToggle={actions.onTogglePublish} />
      </td>
      {editing && (
        <td className={cn(CELL_BORDER, 'p-3')}>
          <Button variant="danger" onClick={actions.onDelete}>
            Zeile löschen
          </Button>
        </td>
      )}
    </tr>
  );
}

const ADVICE_OPTIONS = [
  { value: 'ja', label: 'Ja' },
  { value: 'nein', label: 'Nein' },
];

function EditCell({
  columnKey,
  label,
  clinic,
  onChange,
}: {
  columnKey: EditableKey;
  label: string;
  clinic: AdminClinicRow;
  onChange: (value: CellValue) => void;
}) {
  if (columnKey === 'advises_clients') {
    return (
      <Select
        label={label}
        labelHidden
        options={ADVICE_OPTIONS}
        value={clinic.advises_clients ? 'ja' : 'nein'}
        onChange={(event) => onChange(event.target.value === 'ja')}
      />
    );
  }
  const value = (clinic[columnKey] ?? '') as string;
  const suggestions = MULTI_SUGGESTIONS[columnKey];
  if (suggestions) {
    return (
      <TagCombobox
        label={label}
        labelHidden
        value={value}
        onChange={onChange}
        suggestions={suggestions}
        placeholder="Auswählen oder eingeben…"
      />
    );
  }
  if (columnKey === 'name' || columnKey === 'website' || columnKey === 'contact_email') {
    return (
      <Input
        label={label}
        labelHidden
        type={columnKey === 'website' ? 'url' : columnKey === 'contact_email' ? 'email' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Textarea
      label={label}
      labelHidden
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ReadCell({ column, clinic }: { column: EditableKey; clinic: AdminClinicRow }) {
  if (column === 'advises_clients') {
    return <span className="text-foreground">{clinic.advises_clients ? 'Ja' : 'Nein'}</span>;
  }
  const value = clinic[column];
  if (column === 'website' && value) {
    return (
      <a href={value} target="_blank" rel="noopener" className="break-all text-primary underline">
        {value}
      </a>
    );
  }
  return <span className="break-words text-foreground">{value || '—'}</span>;
}

function ZugangCell({
  clinic,
  onInvite,
  onResetAccess,
}: {
  clinic: AdminClinicRow;
  onInvite: () => void;
  onResetAccess: () => void;
}) {
  if (clinic.accessState === 'no_email') {
    return <span className="text-sm text-muted">Beratungsemail nötig</span>;
  }
  if (clinic.accessState === 'none') {
    return (
      <Button variant="secondary" onClick={onInvite}>
        Zugang aktivieren
      </Button>
    );
  }
  if (clinic.accessState === 'invited') {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Badge variant="warning">Einladung gesendet</Badge>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onInvite}>
            Erneut senden
          </Button>
          <Button variant="secondary" onClick={onResetAccess}>
            Zugang zurücksetzen
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge variant="success">✓ Aktiv</Badge>
      {clinic.lastSignInLabel && (
        <span className="text-xs text-muted-soft">zuletzt {clinic.lastSignInLabel}</span>
      )}
      <Button variant="secondary" onClick={onResetAccess}>
        Zugang zurücksetzen
      </Button>
    </div>
  );
}

function PendingPanel({
  pending,
  onApprove,
  onReject,
}: {
  pending: PendingSubmission[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="rounded-[16px] border border-warning/40 bg-warning-surface/50 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-primary">
        <Badge variant="warning">{pending.length}</Badge>
        Neue Einträge zur Prüfung
      </h3>
      <div className="flex flex-col gap-2">
        {pending.map((submission) => (
          <div
            key={submission.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <div className="text-sm">
              <div className="font-semibold text-foreground">{submission.name}</div>
              <div className="text-muted">
                {submission.region ?? 'Region unbekannt'} · {submission.legal_areas} ·{' '}
                {submission.contact_email}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => onApprove(submission.id)}>
                Freischalten
              </Button>
              <Button variant="secondary" onClick={() => onReject(submission.id)}>
                Ablehnen
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
