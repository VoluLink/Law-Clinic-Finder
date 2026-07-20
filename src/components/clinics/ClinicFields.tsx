'use client';

import type { ChangeEvent } from 'react';

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ClinicEditable } from '@/lib/clinics/schema';

type FieldKey = keyof ClinicEditable;
type FieldConfig = { key: FieldKey; label: string; kind: 'input' | 'textarea' };

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', kind: 'input' },
  { key: 'region', label: 'Region / Stadt', kind: 'input' },
  { key: 'contact_email', label: 'Kontakt-E-Mail (zugleich Anmelde-Adresse)', kind: 'input' },
  { key: 'website', label: 'Website', kind: 'input' },
  { key: 'languages', label: 'Sprachen', kind: 'input' },
  { key: 'legal_areas', label: 'Rechtsgebiete (mit ; getrennt)', kind: 'textarea' },
  { key: 'target_clients', label: 'Zielgruppe / Mandanten', kind: 'textarea' },
  { key: 'requirements', label: 'Voraussetzungen und Ausschlüsse', kind: 'textarea' },
  { key: 'description', label: 'Beschreibung', kind: 'textarea' },
];

type ClinicFieldsProps = {
  value: ClinicEditable;
  onChange: (value: ClinicEditable) => void;
  errors?: Partial<Record<FieldKey, string>>;
};

/** Single source for clinic edit fields — used by the clinic area and the admin modal. */
export function ClinicFields({ value, onChange, errors }: ClinicFieldsProps) {
  const set = (key: FieldKey) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: event.target.value });

  return (
    <div className="flex flex-col gap-4">
      {FIELDS.map(({ key, label, kind }) => {
        const shared = {
          label,
          value: value[key] ?? '',
          onChange: set(key),
          error: errors?.[key],
        };
        return kind === 'input' ? (
          <Input key={key} {...shared} />
        ) : (
          <Textarea key={key} {...shared} />
        );
      })}
    </div>
  );
}
