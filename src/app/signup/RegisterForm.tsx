'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SuggestInput } from '@/components/ui/SuggestInput';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { Textarea } from '@/components/ui/Textarea';
import { LANGUAGES, LEGAL_AREAS, REGION_SUGGESTIONS, TARGET_GROUPS } from '@/lib/clinics/options';
import { clinicSubmissionSchema } from '@/lib/clinics/schema';
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
  description: '',
  requirements: '',
};

type FormValues = typeof EMPTY_FORM;

type RegisterFormProps = {
  onDone: () => void;
  onCollision: (clinic: DirectoryMatch) => void;
  onBack: () => void;
};

export function RegisterForm({ onDone, onCollision, onBack }: RegisterFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
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
      setError('Bitte füllen Sie alle Pflichtfelder korrekt aus (Website mit https://).');
      return;
    }
    setPending(true);
    setError(null);
    const result = await submitRegistration(parsed.data);
    setPending(false);
    if (!result) return setError('Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.');
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name der Law Clinic" value={values.name} onChange={setField('name')} />
        <Input
          label="E-Mail-Adresse der Organisation (Login-Adresse)"
          type="email"
          value={values.contact_email}
          onChange={setField('contact_email')}
        />
        <Input
          label="Website"
          type="url"
          placeholder="https://…"
          value={values.website}
          onChange={setField('website')}
        />
        <SuggestInput
          label="Region"
          value={values.region}
          onChange={setValue('region')}
          suggestions={REGION_SUGGESTIONS}
          placeholder="Stadt oder „Deutschlandweit“"
        />
        <TagCombobox
          label="Rechtsgebiete"
          value={values.legal_areas}
          onChange={setValue('legal_areas')}
          suggestions={LEGAL_AREAS}
          placeholder="Auswählen oder eingeben…"
        />
        <TagCombobox
          label="Zielgruppe / Mandant:innen"
          value={values.target_clients}
          onChange={setValue('target_clients')}
          suggestions={TARGET_GROUPS}
          placeholder="Auswählen oder eingeben…"
        />
        <TagCombobox
          label="Sprachen"
          value={values.languages}
          onChange={setValue('languages')}
          suggestions={LANGUAGES}
          placeholder="Auswählen oder eingeben…"
        />
        <Textarea
          label="Beratungsangebot (optional)"
          value={values.description}
          onChange={setField('description')}
        />
        <Textarea
          label="Andere Voraussetzungen (optional)"
          value={values.requirements}
          onChange={setField('requirements')}
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
