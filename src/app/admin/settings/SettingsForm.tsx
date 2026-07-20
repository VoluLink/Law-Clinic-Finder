'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { chatSettingsUpdateSchema, type ChatSettings } from '@/lib/settings';

type FormStatus = 'idle' | 'pending' | 'saved' | 'error';

export function SettingsForm({ settings }: { settings: ChatSettings }) {
  const [value, setValue] = useState(settings);
  const [status, setStatus] = useState<FormStatus>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = chatSettingsUpdateSchema.safeParse(value);
    if (!parsed.success) {
      setStatus('error');
      return;
    }
    setStatus('pending');
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setStatus(response?.ok ? 'saved' : 'error');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Checkbox
        label="Chat aktiviert"
        checked={value.chat_enabled}
        onChange={(e) => setValue({ ...value, chat_enabled: e.target.checked })}
      />
      <Input
        label="Modell (Anthropic-Modell-ID)"
        value={value.chat_model}
        onChange={(e) => setValue({ ...value, chat_model: e.target.value })}
      />
      <Input
        label="Maximale Antwortlänge (Tokens)"
        type="number"
        value={value.chat_max_tokens}
        onChange={(e) => setValue({ ...value, chat_max_tokens: Number(e.target.value) })}
      />
      <Textarea
        label="System-Prompt"
        rows={10}
        value={value.chat_system_prompt}
        onChange={(e) => setValue({ ...value, chat_system_prompt: e.target.value })}
      />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status === 'pending'}>
          Speichern
        </Button>
        {status === 'saved' && (
          <p role="status" className="text-sm text-muted">
            Gespeichert.
          </p>
        )}
        {status === 'error' && (
          <p role="status" className="text-sm text-danger">
            Speichern fehlgeschlagen. Bitte Eingaben prüfen.
          </p>
        )}
      </div>
    </form>
  );
}
