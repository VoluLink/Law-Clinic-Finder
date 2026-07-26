'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/forms/email';

type Status = 'idle' | 'saving' | 'sent' | 'error';

export function AccountForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [status, setStatus] = useState<Status>('idle');

  const trimmed = email.trim();
  const changed = trimmed.length > 0 && trimmed !== currentEmail;
  const invalid = trimmed.length > 0 && !isValidEmail(trimmed);

  async function save() {
    if (!isValidEmail(trimmed)) return;
    setStatus('saving');
    const response = await fetch('/api/admin/account/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    }).catch(() => null);
    setStatus(response?.ok ? 'sent' : 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-xl text-sm text-muted">
        Übertrage den bestehenden Admin-Zugang auf eine neue E-Mail-Adresse. Die Admin-Rolle bleibt
        dabei mit demselben Konto verknüpft.
      </p>
      <Panel
        title="Admin-E-Mail-Adresse"
        hint="An diese Adresse gehen Anmeldelinks und Systembenachrichtigungen."
      >
        <div className="flex max-w-md flex-col gap-4">
          <Input
            label="E-Mail-Adresse"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@law-clinics.de"
            error={invalid ? INVALID_EMAIL_MESSAGE : undefined}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Aktuell: {currentEmail || '—'}</span>
            <Button onClick={save} disabled={!changed || invalid || status === 'saving'}>
              Speichern
            </Button>
          </div>
          {status === 'sent' && (
            <p role="status" className="text-sm text-muted">
              Bestätigungs-E-Mail an die alte und neue Adresse gesendet. Nach der Bestätigung wird
              derselbe Admin-Zugang auf die neue Adresse übertragen.
            </p>
          )}
          {status === 'error' && (
            <p role="status" className="text-sm text-danger">
              Änderung fehlgeschlagen. Bitte E-Mail-Adresse prüfen.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
