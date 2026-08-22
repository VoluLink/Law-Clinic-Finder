'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type FormState = 'idle' | 'pending' | 'sent' | 'not_registered' | 'invalid' | 'error';

const loginResponseSchema = z.object({ status: z.enum(['sent', 'not_registered']) }).strict();

/** Reasons /auth/confirm can bounce someone back here. Without these the form
 *  reappeared blank after an expired link, which reads as "nothing happened". */
const LINK_ERRORS: Record<string, string> = {
  '1': 'Dieser Anmeldelink ist abgelaufen oder wurde bereits benutzt. Fordere einen neuen an.',
  no_access:
    'Für diese E-Mail-Adresse gibt es noch keinen Zugang. Registriere zuerst deine Law Clinic.',
};

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const linkError = LINK_ERRORS[useSearchParams().get('error') ?? ''];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
      setState('invalid');
      return;
    }
    setState('pending');
    setState(await requestLogin(email.trim()));
  }

  if (state === 'sent') {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm text-foreground">
          Wir haben dir einen Anmeldelink geschickt. Prüfe dein E-Mail-Postfach.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {linkError && (
        <p role="alert" className="text-sm text-danger">
          {linkError}
        </p>
      )}
      {state === 'not_registered' && (
        <p role="alert" className="text-sm text-danger">
          Diese E-Mail-Adresse ist nicht registriert. Wenn du für eine Law Clinic Zugang brauchst,{' '}
          <Link href="/signup" className="font-semibold underline">
            registriere sie zuerst
          </Link>
          .
        </p>
      )}
      <Input
        label="E-Mail-Adresse deiner Organisation"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={
          state === 'invalid'
            ? 'Bitte gib eine gültige E-Mail-Adresse ein.'
            : state === 'error'
              ? 'Anmeldung derzeit nicht möglich. Bitte versuche es später erneut.'
              : undefined
        }
      />
      <Button type="submit" disabled={state === 'pending'}>
        Anmeldelink senden
      </Button>
    </form>
  );
}

async function requestLogin(email: string): Promise<FormState> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => null);
  if (!response?.ok) return 'error';
  const body = await response.json().catch(() => null);
  const parsed = loginResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.status : 'error';
}
