'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EditActions } from '@/components/clinics/EditActions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InfoHint } from '@/components/ui/InfoHint';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import type { AccessState } from '@/lib/admin/clinic-access';
import { FIELD_HELP } from '@/lib/clinics/field-help';
import { LANGUAGES, LEGAL_AREAS, REGION_SUGGESTIONS, TARGET_GROUPS } from '@/lib/clinics/options';
import {
  publishBlockers,
  PUBLISH_KEYS,
  toRequiredLabels,
} from '@/lib/clinics/publish-requirements';
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

  // Publishing is gated on completeness; hiding is always allowed. The server
  // re-checks — this just avoids a doomed round-trip and names what's missing.
  function togglePublish(clinic: AdminClinicRow) {
    if (!clinic.is_published) {
      const missing = toRequiredLabels(publishBlockers(clinic));
      if (missing.length > 0) {
        setStatus(`Zum Veröffentlichen fehlt noch: ${missing.join(', ')}.`);
        return;
      }
    }
    call(
      `/api/admin/clinics/${clinic.id}`,
      patch({ is_published: !clinic.is_published }),
      clinic.is_published ? 'Verborgen.' : 'Veröffentlicht.',
    );
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
          <div className="overflow-x-auto rounded-[16px] border border-border bg-surface">
            <table className="w-full min-w-[1500px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-bold tracking-wide text-muted-soft uppercase">
                  {COLUMNS.map((column) => {
                    const help = FIELD_HELP[column.key];
                    return (
                      <th key={column.key} className="p-3 text-start font-bold">
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
                  <th className="p-3 text-start font-bold">Zugang</th>
                  <th className="p-3 text-start font-bold">Status</th>
                  {editing && <th className="p-3 text-start font-bold">Aktionen</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((clinic) => (
                  <ClinicRow
                    key={clinic.id}
                    clinic={editing ? (drafts[clinic.id] ?? clinic) : clinic}
                    editing={editing}
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
                    onRevoke={() =>
                      window.confirm('Zugang entziehen?') &&
                      call(
                        `/api/admin/clinics/${clinic.id}/access`,
                        { method: 'DELETE' },
                        'Zugang entzogen.',
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type RowActions = {
  onCell: (key: EditableKey, value: CellValue) => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onInvite: () => void;
  onRevoke: () => void;
};

function ClinicRow({
  clinic,
  editing,
  ...actions
}: { clinic: AdminClinicRow; editing: boolean } & RowActions) {
  return (
    <tr className="border-b border-border align-top last:border-0">
      {COLUMNS.map((column) => (
        <td key={column.key} className="min-w-[150px] p-3">
          {editing ? (
            <EditCell
              columnKey={column.key}
              label={column.label}
              clinic={clinic}
              onChange={(value) => actions.onCell(column.key, value)}
            />
          ) : (
            <ReadCell column={column.key} clinic={clinic} />
          )}
        </td>
      ))}
      <td className="min-w-[190px] p-3">
        <ZugangCell clinic={clinic} onInvite={actions.onInvite} onRevoke={actions.onRevoke} />
      </td>
      <td className="p-3">
        <button type="button" onClick={actions.onTogglePublish}>
          <Badge variant={clinic.is_published ? 'primary' : 'neutral'}>
            {clinic.is_published ? 'Veröffentlicht' : 'Entwurf'}
          </Badge>
        </button>
      </td>
      {editing && (
        <td className="p-3">
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
  onRevoke,
}: {
  clinic: AdminClinicRow;
  onInvite: () => void;
  onRevoke: () => void;
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
          <Button variant="ghost" onClick={onRevoke}>
            zurücksetzen
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
      <Button variant="ghost" onClick={onRevoke}>
        Zugang entziehen
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
