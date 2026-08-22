'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '@/lib/forms/email';

type Status = 'idle' | 'saving' | 'sent' | 'reauth' | 'error';

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
    if (response?.ok) return setStatus('sent');
    const body = (await response?.json().catch(() => null)) as { code?: string } | null;
    setStatus(body?.code === 'reauth_required' ? 'reauth' : 'error');
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
            placeholder="admin@example.org"
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
              Bestätigungs-E-Mail an die neue Adresse gesendet. Nach der Bestätigung wird derselbe
              Admin-Zugang übertragen; die bisherige Adresse erhält eine Sicherheitsnachricht.
            </p>
          )}
          {status === 'reauth' && (
            <div role="alert" className="flex flex-col items-start gap-2 text-sm text-danger">
              <p>
                Diese Änderung erfordert eine neue Anmeldung. Melde dich ab und direkt wieder an.
              </p>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="secondary">
                  Abmelden und neu anmelden
                </Button>
              </form>
            </div>
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
