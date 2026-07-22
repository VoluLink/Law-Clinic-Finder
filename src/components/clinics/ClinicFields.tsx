'use client';

import type { ChangeEvent } from 'react';

import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import { LANGUAGES, LEGAL_AREAS, REGION_SUGGESTIONS, TARGET_GROUPS } from '@/lib/clinics/options';
import type { ClinicEditable } from '@/lib/clinics/schema';

type FieldKey = keyof ClinicEditable;
type FieldConfig =
  | { key: FieldKey; label: string; kind: 'input' | 'textarea' }
  | {
      key: FieldKey;
      label: string;
      kind: 'suggest' | 'multiselect';
      suggestions: readonly string[];
    };

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', kind: 'input' },
  { key: 'region', label: 'Region / Stadt', kind: 'suggest', suggestions: REGION_SUGGESTIONS },
  { key: 'contact_email', label: 'Kontakt-E-Mail (zugleich Anmelde-Adresse)', kind: 'input' },
  { key: 'website', label: 'Website', kind: 'input' },
  { key: 'languages', label: 'Sprachen', kind: 'multiselect', suggestions: LANGUAGES },
  { key: 'legal_areas', label: 'Rechtsgebiete', kind: 'multiselect', suggestions: LEGAL_AREAS },
  {
    key: 'target_clients',
    label: 'Zielgruppe / Mandanten',
    kind: 'multiselect',
    suggestions: TARGET_GROUPS,
  },
  { key: 'requirements', label: 'Voraussetzungen und Ausschlüsse', kind: 'textarea' },
  { key: 'description', label: 'Beschreibung', kind: 'textarea' },
];

type ClinicFieldsProps = {
  value: ClinicEditable;
  onChange: (value: ClinicEditable) => void;
  errors?: Partial<Record<FieldKey, string>>;
};

/** Single source for the clinic edit fields — used by the member portal form. */
export function ClinicFields({ value, onChange, errors }: ClinicFieldsProps) {
  const set = (key: FieldKey) => (next: string) => onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-4">
      {FIELDS.map((field) => {
        const current = value[field.key] ?? '';
        const error = errors?.[field.key];
        if (field.kind === 'multiselect') {
          return (
            <TagCombobox
              key={field.key}
              label={field.label}
              value={current}
              onChange={set(field.key)}
              suggestions={field.suggestions}
              error={error}
              placeholder="Auswählen oder eingeben…"
            />
          );
        }
        if (field.kind === 'suggest') {
          return (
            <SuggestInput
              key={field.key}
              label={field.label}
              value={current}
              onChange={set(field.key)}
              suggestions={field.suggestions}
              error={error}
              placeholder="Stadt eingeben oder auswählen…"
            />
          );
        }
        const shared = {
          label: field.label,
          value: current,
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            set(field.key)(event.target.value),
          error,
        };
        return field.kind === 'input' ? (
          <Input key={field.key} {...shared} />
        ) : (
          <Textarea key={field.key} {...shared} />
        );
      })}
    </div>
  );
}
