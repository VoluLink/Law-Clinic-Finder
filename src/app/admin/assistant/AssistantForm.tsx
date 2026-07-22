'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Textarea } from '@/components/ui/Textarea';
import {
  chatSettingsUpdateSchema,
  MAX_CHAT_GREETING_CHARS,
  MAX_CHAT_MAX_TOKENS,
  MAX_CHAT_RECOMMENDATIONS,
  type ChatSettings,
} from '@/lib/settings';

type FormStatus = 'idle' | 'pending' | 'saved' | 'error';

export function AssistantForm({ settings }: { settings: ChatSettings }) {
  const [value, setValue] = useState(settings);
  const [status, setStatus] = useState<FormStatus>('idle');

  const set = <K extends keyof ChatSettings>(key: K, next: ChatSettings[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Panel
        title="Betrieb"
        hint="Modell, Kosten und Kill-Switch. Ist der Assistent aus, sehen Ratsuchende im Chat einen Hinweis statt einer Antwort."
      >
        <div className="flex flex-col gap-4">
          <Checkbox
            label="Assistent aktiviert"
            checked={value.chat_enabled}
            onChange={(e) => set('chat_enabled', e.target.checked)}
          />
          <Input
            label="Modell (Anthropic-Modell-ID)"
            value={value.chat_model}
            onChange={(e) => set('chat_model', e.target.value)}
          />
          <Input
            label={`Maximale Antwortlänge in Tokens (höchstens ${MAX_CHAT_MAX_TOKENS})`}
            type="number"
            min={1}
            max={MAX_CHAT_MAX_TOKENS}
            value={value.chat_max_tokens}
            onChange={(e) => set('chat_max_tokens', Number(e.target.value))}
          />
          <Input
            label="Temperatur (0 = immer gleiche Empfehlung, 1 = kreativer)"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={value.chat_temperature}
            onChange={(e) => set('chat_temperature', Number(e.target.value))}
          />
        </div>
      </Panel>

      <Panel
        title="Anweisungen"
        hint="Die Rolle sagt, wer der Assistent ist und was er nicht darf. Der Ablauf sagt, wie er ein Gespräch abarbeitet — hier änderst du das Verhalten."
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label="Rolle"
            rows={10}
            value={value.chat_system_prompt}
            onChange={(e) => set('chat_system_prompt', e.target.value)}
          />
          <Textarea
            label="Ablauf (Schritt für Schritt)"
            rows={14}
            value={value.chat_skill}
            onChange={(e) => set('chat_skill', e.target.value)}
          />
        </div>
      </Panel>

      <Panel
        title="Darstellung"
        hint="Was Ratsuchende auf der Startseite sehen. Die Begrüßung wird nicht übersetzt — sie erscheint in allen Sprachen genau so, wie sie hier steht."
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label={`Begrüßung (leer lassen für keine; höchstens ${MAX_CHAT_GREETING_CHARS} Zeichen)`}
            rows={3}
            maxLength={MAX_CHAT_GREETING_CHARS}
            value={value.chat_greeting}
            onChange={(e) => set('chat_greeting', e.target.value)}
          />
          <Input
            label={`Maximale Anzahl empfohlener Law Clinics (1 bis ${MAX_CHAT_RECOMMENDATIONS})`}
            type="number"
            min={1}
            max={MAX_CHAT_RECOMMENDATIONS}
            value={value.chat_max_recommendations}
            onChange={(e) => set('chat_max_recommendations', Number(e.target.value))}
          />
        </div>
      </Panel>

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
