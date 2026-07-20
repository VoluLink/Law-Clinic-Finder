'use client';

import { useState, type FormEvent } from 'react';

import { ClinicFields } from '@/components/clinics/ClinicFields';
import { Button } from '@/components/ui/Button';
import { clinicEditableSchema, type ClinicEditable } from '@/lib/clinics/schema';

type FormStatus = 'idle' | 'pending' | 'saved' | 'error';

const STATUS_TEXT: Partial<Record<FormStatus, string>> = {
  saved: 'Gespeichert.',
  error: 'Speichern fehlgeschlagen. Bitte prüfen Sie Ihre Eingaben.',
};

export function ClinicForm({ clinic }: { clinic: ClinicEditable }) {
  const [value, setValue] = useState(clinic);
  const [status, setStatus] = useState<FormStatus>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicEditableSchema.safeParse(value);
    if (!parsed.success) {
      setStatus('error');
      return;
    }
    setStatus('pending');
    const response = await fetch('/api/clinic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setStatus(response?.ok ? 'saved' : 'error');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <ClinicFields value={value} onChange={setValue} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status === 'pending'}>
          Speichern
        </Button>
        {STATUS_TEXT[status] && (
          <p
            role="status"
            className={status === 'error' ? 'text-sm text-danger' : 'text-sm text-muted'}
          >
            {STATUS_TEXT[status]}
          </p>
        )}
      </div>
    </form>
  );
}
