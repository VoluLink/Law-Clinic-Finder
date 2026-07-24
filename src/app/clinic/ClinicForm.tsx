'use client';

import { useState, type FormEvent } from 'react';

import { ClinicFields } from '@/components/clinics/ClinicFields';
import { EditActions } from '@/components/clinics/EditActions';
import { Button } from '@/components/ui/Button';
import { clinicMemberSaveSchema, type ClinicEditable } from '@/lib/clinics/schema';
import { fieldErrorsFrom } from '@/lib/forms/field-errors';

type FormStatus = 'idle' | 'pending' | 'saved' | 'error';
type FieldErrors = Partial<Record<keyof ClinicEditable, string>>;

const STATUS_TEXT: Partial<Record<FormStatus, string>> = {
  saved: 'Gespeichert.',
  error: 'Bitte fülle alle Pflichtfelder aus.',
};

export function ClinicForm({ clinic }: { clinic: ClinicEditable }) {
  const [value, setValue] = useState(clinic);
  const [baseline, setBaseline] = useState(clinic);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicMemberSaveSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom<keyof ClinicEditable>(parsed.error.issues));
      setStatus('error');
      return;
    }
    setErrors({});
    setStatus('pending');
    const response = await fetch('/api/clinic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    if (!response?.ok) {
      setStatus('error');
      return;
    }
    setBaseline(value);
    setEditing(false);
    setStatus('saved');
  }

  function cancelEditing() {
    setValue(baseline);
    setErrors({});
    setStatus('idle');
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-6">
        <ClinicFields value={value} onChange={setValue} readOnly />
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={() => {
              setStatus('idle');
              setEditing(true);
            }}
          >
            Bearbeiten
          </Button>
          <StatusNote status={status} />
        </div>
      </div>
    );
  }

  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ClinicFields value={value} onChange={setValue} errors={errors} />
      <EditActions
        saveType="submit"
        dirty={dirty}
        busy={status === 'pending'}
        onCancel={cancelEditing}
      >
        <StatusNote status={status} />
      </EditActions>
    </form>
  );
}

function StatusNote({ status }: { status: FormStatus }) {
  if (!STATUS_TEXT[status]) return null;
  return (
    <p role="status" className={status === 'error' ? 'text-sm text-danger' : 'text-sm text-muted'}>
      {STATUS_TEXT[status]}
    </p>
  );
}
