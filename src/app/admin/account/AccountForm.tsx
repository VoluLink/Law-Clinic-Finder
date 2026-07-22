'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';

type Status = 'idle' | 'saving' | 'sent' | 'error';

export function AccountForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [status, setStatus] = useState<Status>('idle');

  const changed = email.trim().length > 0 && email.trim() !== currentEmail;

  async function save() {
    setStatus('saving');
    const response = await fetch('/api/admin/account/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    setStatus(response?.ok ? 'sent' : 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-xl text-sm text-muted">
        Verwalte den Zugang des Admin-Teams. Die E-Mail-Adresse wird für die Anmeldung und für
        interne Benachrichtigungen verwendet.
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
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Aktuell: {currentEmail || '—'}</span>
            <Button onClick={save} disabled={!changed || status === 'saving'}>
              Speichern
            </Button>
          </div>
          {status === 'sent' && (
            <p role="status" className="text-sm text-muted">
              Bestätigungs-E-Mail an die alte und neue Adresse gesendet. Die Änderung wird erst nach
              Bestätigung wirksam.
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
