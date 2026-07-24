'use client';

import { useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type FormState = 'idle' | 'pending' | 'sent' | 'error';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
      setState('error');
      return;
    }
    setState('pending');
    const supabase = createSupabaseBrowserClient();
    // shouldCreateUser: false = invite-only — unknown addresses get no account.
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: false },
    });
    setState(error ? 'error' : 'sent');
  }

  if (state === 'sent') {
    return (
      <p role="status" className="text-sm text-foreground">
        Prüfe dein E-Mail-Postfach: Wir haben dir einen Anmeldelink geschickt.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="E-Mail-Adresse deiner Organisation"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={
          state === 'error'
            ? 'Anmeldung nicht möglich. Prüfe die Adresse oder kontaktiere den Admin.'
            : undefined
        }
      />
      <Button type="submit" disabled={state === 'pending'}>
        Anmeldelink senden
      </Button>
    </form>
  );
}
