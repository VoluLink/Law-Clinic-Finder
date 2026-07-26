'use client';

import { useState, type FormEvent } from 'react';

import { PROMPT_TOOLBOX } from '@/lib/chat/prompts';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import {
  chatSettingsUpdateSchema,
  MAX_CHAT_GREETING_CHARS,
  MAX_CHAT_MAX_TOKENS,
  MAX_CHAT_RECOMMENDATIONS,
  type ChatSettings,
} from '@/lib/settings';

type FormStatus = 'idle' | 'pending' | 'saved' | 'error';

/** Numeric fields may be blank while editing; the update schema rejects a blank
 *  on save, so an incomplete form cannot be persisted. */
type FormState = Omit<
  ChatSettings,
  'chat_max_tokens' | 'chat_temperature' | 'chat_max_recommendations' | 'chat_grounding_policy'
> & {
  chat_max_tokens: number | '';
  chat_temperature: number | '';
  chat_max_recommendations: number | '';
};

type AssistantFormProps = {
  initial: Partial<ChatSettings>;
  defaults: { chat_system_prompt: string; chat_skill: string };
};

function toFormState(initial: Partial<ChatSettings>): FormState {
  return {
    chat_model: initial.chat_model ?? '',
    chat_enabled: initial.chat_enabled ?? false,
    chat_max_tokens: initial.chat_max_tokens ?? '',
    chat_temperature: initial.chat_temperature ?? '',
    chat_system_prompt: initial.chat_system_prompt ?? '',
    chat_skill: initial.chat_skill ?? '',
    chat_greeting: initial.chat_greeting ?? '',
    chat_max_recommendations: initial.chat_max_recommendations ?? '',
  };
}

const numberInput = (raw: string): number | '' => (raw === '' ? '' : Number(raw));

export function AssistantForm({ initial, defaults }: AssistantFormProps) {
  const [value, setValue] = useState<FormState>(() => toFormState(initial));
  const [baseline, setBaseline] = useState<FormState>(() => toFormState(initial));
  const [status, setStatus] = useState<FormStatus>('idle');

  const set = <K extends keyof FormState>(key: K, next: FormState[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);
  const botCannotRun = !value.chat_system_prompt.trim() || !value.chat_skill.trim();

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
    if (response?.ok) setBaseline(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {botCannotRun && (
        <div
          role="alert"
          className="rounded-lg border border-danger bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Der Chatbot kann so nicht arbeiten: Rolle und Ablauf dürfen nicht leer sein. Solange eine
          der beiden fehlt, sehen Ratsuchende auf der Startseite einen Hinweis statt des Chats.
        </div>
      )}

      <Panel
        title="Betrieb"
        hint="Modell, Kosten und Kill-Switch. Ist der Chatbot aus, sehen Ratsuchende auf der Startseite einen Hinweis statt des Chats."
      >
        <div className="flex flex-col gap-4">
          <Toggle
            label="Chatbot aktiviert"
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
            onChange={(e) => set('chat_max_tokens', numberInput(e.target.value))}
          />
          <Input
            label="Temperatur (0 = immer gleiche Empfehlung, 1 = kreativer)"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={value.chat_temperature}
            onChange={(e) => set('chat_temperature', numberInput(e.target.value))}
          />
        </div>
      </Panel>

      <Panel
        title="Anweisungen"
        hint="Die Rolle sagt, wer der Assistent ist und was er nicht darf. Der Ablauf sagt, wie er ein Gespräch abarbeitet. Das hier ist der live wirksame Prompt — was du speicherst, gilt sofort für alle Ratsuchenden."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Textarea
              label="Rolle"
              rows={10}
              value={value.chat_system_prompt}
              onChange={(e) => set('chat_system_prompt', e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => set('chat_system_prompt', defaults.chat_system_prompt)}
                disabled={
                  !defaults.chat_system_prompt ||
                  value.chat_system_prompt === defaults.chat_system_prompt
                }
              >
                Auf Standard zurücksetzen
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Textarea
              label="Ablauf (Schritt für Schritt)"
              rows={14}
              value={value.chat_skill}
              onChange={(e) => set('chat_skill', e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => set('chat_skill', defaults.chat_skill)}
                disabled={!defaults.chat_skill || value.chat_skill === defaults.chat_skill}
              >
                Auf Standard zurücksetzen
              </Button>
            </div>
          </div>
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
            onChange={(e) => set('chat_max_recommendations', numberInput(e.target.value))}
          />
        </div>
      </Panel>

      <Panel
        title="Toolbox"
        hint="Diese Werkzeuge kann der Assistent im Ablauf aufrufen. Schreibe die Namen genau so, wenn du sie im Ablauf verwendest."
      >
        <dl className="flex flex-col gap-4">
          {PROMPT_TOOLBOX.map((tool) => (
            <div key={tool.name} className="flex flex-col gap-1">
              <dt className="font-mono text-sm text-foreground">{tool.name}</dt>
              <dd className="text-sm text-muted">{tool.description}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={!dirty || status === 'pending'}>
          Speichern &amp; veröffentlichen
        </Button>
        {status === 'saved' && (
          <p role="status" className="text-sm text-muted">
            Veröffentlicht.
          </p>
        )}
        {status === 'error' && (
          <p role="status" className="text-sm text-danger">
            Speichern fehlgeschlagen. Bitte Eingaben prüfen.
          </p>
        )}
        {dirty && status !== 'saved' && (
          <span className="text-sm text-muted-soft">Ungespeicherte Änderungen</span>
        )}
      </div>
    </form>
  );
}
