'use client';

import type { ChangeEvent } from 'react';

import { AdviceField } from '@/components/clinics/AdviceField';
import { Badge } from '@/components/ui/Badge';
import { InfoHint } from '@/components/ui/InfoHint';
import { Input } from '@/components/ui/Input';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import { FIELD_HELP } from '@/lib/clinics/field-help';
import {
  LANGUAGES,
  LEGAL_AREAS,
  parseMultiValue,
  REGION_SUGGESTIONS,
  TARGET_GROUPS,
} from '@/lib/clinics/options';
import { MEMBER_KEYS } from '@/lib/clinics/publish-requirements';
import type { ClinicEditable } from '@/lib/clinics/schema';

const MEMBER_REQUIRED = new Set<string>(MEMBER_KEYS);

type FieldKey = keyof ClinicEditable;
type FieldConfig =
  | { key: FieldKey; label: string; kind: 'input'; type?: 'email' }
  | { key: FieldKey; label: string; kind: 'textarea' | 'advice' }
  | {
      key: FieldKey;
      label: string;
      kind: 'multiselect';
      suggestions: readonly string[];
    };

const FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Name', kind: 'input' },
  {
    key: 'contact_email',
    label: 'Beratungsemail (zugleich Anmelde-Adresse)',
    kind: 'input',
    type: 'email',
  },
  { key: 'website', label: 'Homepage', kind: 'input' },
  { key: 'region', label: 'Region / Stadt', kind: 'multiselect', suggestions: REGION_SUGGESTIONS },
  { key: 'legal_areas', label: 'Rechtsgebiete', kind: 'multiselect', suggestions: LEGAL_AREAS },
  {
    key: 'target_clients',
    label: 'Zielgruppe / Mandant:innen',
    kind: 'multiselect',
    suggestions: TARGET_GROUPS,
  },
  { key: 'languages', label: 'Sprachen', kind: 'multiselect', suggestions: LANGUAGES },
  { key: 'advises_clients', label: 'Beratungsarbeit', kind: 'advice' },
  { key: 'requirements', label: 'Voraussetzungen und Ausschlüsse', kind: 'textarea' },
];

type ClinicFieldsProps = {
  value: ClinicEditable;
  onChange: (value: ClinicEditable) => void;
  errors?: Partial<Record<FieldKey, string>>;
  /** Renders the same fields as static text (member portal view mode). */
  readOnly?: boolean;
};

/** Single source for the clinic edit fields — used by the member portal form. */
export function ClinicFields({ value, onChange, errors, readOnly }: ClinicFieldsProps) {
  const set = (key: FieldKey) => (next: string) => onChange({ ...value, [key]: next });

  if (readOnly) {
    return (
      <dl className="flex flex-col gap-4">
        {FIELDS.map((field) => {
          const shared = {
            label: field.label,
            hint: FIELD_HELP[field.key],
            required: MEMBER_REQUIRED.has(field.key),
          };
          if (field.kind === 'advice') {
            const answer = value.advises_clients ? 'Ja' : 'Nein';
            const text = value.description ? `${answer} — ${value.description}` : answer;
            return <ReadField key={field.key} {...shared} text={text} />;
          }
          const current = (value[field.key] ?? '') as string;
          return field.kind === 'multiselect' ? (
            <ReadField key={field.key} {...shared} items={parseMultiValue(current)} />
          ) : (
            <ReadField key={field.key} {...shared} text={current} />
          );
        })}
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {FIELDS.map((field) => {
        if (field.kind === 'advice') {
          return (
            <AdviceField
              key={field.key}
              advises={value.advises_clients}
              description={value.description ?? ''}
              onAdvisesChange={(advises) => onChange({ ...value, advises_clients: advises })}
              onDescriptionChange={(text) => onChange({ ...value, description: text })}
              error={errors?.description}
            />
          );
        }
        // Every remaining field is string-valued; the advice branch above owns
        // the only boolean key.
        const current = (value[field.key] ?? '') as string;
        const error = errors?.[field.key];
        const hint = FIELD_HELP[field.key];
        const required = MEMBER_REQUIRED.has(field.key);
        if (field.kind === 'multiselect') {
          return (
            <TagCombobox
              key={field.key}
              label={field.label}
              value={current}
              onChange={set(field.key)}
              suggestions={field.suggestions}
              error={error}
              hint={hint}
              required={required}
              placeholder="Auswählen oder eingeben…"
            />
          );
        }
        const shared = {
          label: field.label,
          value: current,
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            set(field.key)(event.target.value),
          error,
          hint,
          required,
        };
        return field.kind === 'input' ? (
          <Input key={field.key} type={field.type} {...shared} />
        ) : (
          <Textarea key={field.key} {...shared} />
        );
      })}
    </div>
  );
}

/** One read-only field: multi-value items become badges, plain text stays text. */
function ReadField({
  label,
  text,
  items,
  hint,
  required,
}: {
  label: string;
  text?: string;
  items?: string[];
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span>
          {label}
          {required && (
            <>
              <span className="text-danger" aria-hidden>
                {' '}
                *
              </span>
              <span className="sr-only"> (Pflichtfeld)</span>
            </>
          )}
        </span>
        {hint && <InfoHint text={hint} label={label} />}
      </dt>
      {items ? (
        <dd className="flex flex-wrap gap-1.5">
          {items.length ? (
            items.map((item) => (
              <Badge key={item} variant="neutral">
                {item}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </dd>
      ) : (
        <dd className="text-sm whitespace-pre-wrap text-muted">{text?.trim() || '—'}</dd>
      )}
    </div>
  );
}
