'use client';

import { useState, type FormEvent } from 'react';

import { AdviceField } from '@/components/clinics/AdviceField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import { FIELD_HELP } from '@/lib/clinics/field-help';
import { LANGUAGES, LEGAL_AREAS, REGION_SUGGESTIONS, TARGET_GROUPS } from '@/lib/clinics/options';
import { clinicSubmissionSchema } from '@/lib/clinics/schema';
import { fieldErrorsFrom } from '@/lib/forms/field-errors';
import type { DirectoryMatch } from '@/lib/signup/directory';
import type { RegisterResult } from '@/lib/signup/handle-register';

import { BackLink, StageHeading } from '@/components/ui/StageShell';

const EMPTY_FORM = {
  name: '',
  contact_email: '',
  website: '',
  region: '',
  legal_areas: '',
  target_clients: '',
  languages: '',
  advises_clients: true,
  description: '',
  requirements: '',
};

type FormValues = typeof EMPTY_FORM;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

type RegisterFormProps = {
  onDone: () => void;
  onCollision: (clinic: DirectoryMatch) => void;
  onBack: () => void;
};

export function RegisterForm({ onDone, onCollision, onBack }: RegisterFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  function setValue(field: keyof FormValues) {
    return (value: string) => setValues((prev) => ({ ...prev, [field]: value }));
  }

  function setField(field: keyof FormValues) {
    return (event: { target: { value: string } }) => setValue(field)(event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = clinicSubmissionSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom<keyof FormValues>(parsed.error.issues));
      setError('Bitte fülle alle Pflichtfelder korrekt aus (Website mit https://).');
      return;
    }
    setErrors({});
    setPending(true);
    setError(null);
    const result = await submitRegistration(parsed.data);
    setPending(false);
    if (!result) return setError('Etwas ist schiefgelaufen. Bitte versuche es später erneut.');
    if (result.status === 'collision') return onCollision(result.clinic);
    onDone();
  }

  return (
    <Card variant="panel" className="flex flex-col gap-5">
      <BackLink onClick={onBack} />
      <StageHeading>Neue Law Clinic eintragen</StageHeading>
      <p className="text-base text-muted">
        Der Eintrag wird vom Team von Law Clinics Deutschland geprüft und freigeschaltet.
      </p>
      <p className="text-sm text-muted-soft">
        <span className="text-danger">*</span> Pflichtfeld
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name der Law Clinic"
          value={values.name}
          onChange={setField('name')}
          hint={FIELD_HELP.name}
          required
          error={errors.name}
        />
        <Input
          label="E-Mail-Adresse der Organisation (Login-Adresse)"
          type="email"
          value={values.contact_email}
          onChange={setField('contact_email')}
          hint={FIELD_HELP.contact_email}
          required
          error={errors.contact_email}
        />
        <Input
          label="Website"
          type="url"
          placeholder="https://…"
          value={values.website}
          onChange={setField('website')}
          required
          error={errors.website}
        />
        <TagCombobox
          label="Region"
          value={values.region}
          onChange={setValue('region')}
          suggestions={REGION_SUGGESTIONS}
          placeholder="Stadt oder „Bundesweit“"
          hint={FIELD_HELP.region}
          required
          error={errors.region}
        />
        <TagCombobox
          label="Rechtsgebiete"
          value={values.legal_areas}
          onChange={setValue('legal_areas')}
          suggestions={LEGAL_AREAS}
          placeholder="Auswählen oder eingeben…"
          hint={FIELD_HELP.legal_areas}
          required
          error={errors.legal_areas}
        />
        <TagCombobox
          label="Zielgruppe / Mandant:innen"
          value={values.target_clients}
          onChange={setValue('target_clients')}
          suggestions={TARGET_GROUPS}
          placeholder="Auswählen oder eingeben…"
          hint={FIELD_HELP.target_clients}
          required
          error={errors.target_clients}
        />
        <TagCombobox
          label="Sprachen"
          value={values.languages}
          onChange={setValue('languages')}
          suggestions={LANGUAGES}
          placeholder="Auswählen oder eingeben…"
          hint={FIELD_HELP.languages}
          required
          error={errors.languages}
        />
        <AdviceField
          advises={values.advises_clients}
          description={values.description}
          onAdvisesChange={(advises) =>
            setValues((prev) => ({ ...prev, advises_clients: advises }))
          }
          onDescriptionChange={setValue('description')}
          error={errors.description}
        />
        <Textarea
          label="Andere Voraussetzungen (optional)"
          value={values.requirements}
          onChange={setField('requirements')}
          hint={FIELD_HELP.requirements}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          shape="pill"
          className="w-full py-4 text-base font-bold"
        >
          Zur Prüfung einreichen
        </Button>
      </form>
    </Card>
  );
}

async function submitRegistration(payload: unknown): Promise<RegisterResult | null> {
  try {
    const response = await fetch('/api/signup/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return (await response.json()) as RegisterResult;
  } catch {
    return null;
  }
}
