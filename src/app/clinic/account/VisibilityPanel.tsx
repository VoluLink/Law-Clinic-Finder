'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { MAX_HIDDEN_DAYS, type VisibilityState } from '@/lib/clinics/visibility';

type VisibilityPanelProps = { state: VisibilityState; hiddenUntilLabel: string | null };

const CHOICES: { value: VisibilityState; label: string; hint: string }[] = [
  {
    value: 'visible',
    label: 'Sichtbar',
    hint: 'Der Eintrag steht im Finder und die KI kann ihn vorschlagen.',
  },
  {
    value: 'temporary',
    label: 'Vorübergehend ausblenden',
    hint: 'Der Eintrag verschwindet aus dem Finder und kommt am gewählten Tag von selbst zurück.',
  },
  {
    value: 'permanent',
    label: 'Ausblenden ohne Enddatum',
    hint: 'Der Eintrag bleibt ausgeblendet, bis du ihn hier wieder sichtbar schaltest.',
  },
];

/** Pausing is deliberately not deleting: the entry, the login and every answer
 *  stay exactly as they are, so coming back costs one click. */
export function VisibilityPanel({ state, hiddenUntilLabel }: VisibilityPanelProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<VisibilityState>(state);
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError('');
    setStatus('');
    const response = await fetch('/api/clinic/visibility', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: choice, until: choice === 'temporary' ? until : null }),
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Speichern fehlgeschlagen. Bitte versuche es erneut.');
      return;
    }
    setStatus('Sichtbarkeit gespeichert.');
    router.refresh();
  }

  return (
    <Panel title="Sichtbarkeit im Finder" hint={currentHint(state, hiddenUntilLabel)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Sichtbarkeit</legend>
        {CHOICES.map((option) => (
          <label key={option.value} className="flex items-start gap-3">
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">{option.label}</span>
              <span className="block text-sm text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {choice === 'temporary' && (
        <div className="mt-4 max-w-xs">
          <Input
            type="date"
            label="Wieder sichtbar ab"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            hint={`Höchstens ${MAX_HIDDEN_DAYS} Tage im Voraus.`}
            required
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="mt-3 text-sm text-muted">
          {status}
        </p>
      )}

      <div className="mt-4">
        <Button onClick={save} disabled={pending || (choice === 'temporary' && !until)}>
          {pending ? 'Wird gespeichert…' : 'Sichtbarkeit speichern'}
        </Button>
      </div>
    </Panel>
  );
}

function currentHint(state: VisibilityState, hiddenUntilLabel: string | null): string {
  if (state === 'visible') return 'Dein Eintrag ist derzeit im Finder sichtbar.';
  if (state === 'temporary' && hiddenUntilLabel) {
    return `Dein Eintrag ist ausgeblendet und erscheint am ${hiddenUntilLabel} wieder.`;
  }
  return 'Dein Eintrag ist derzeit ausgeblendet.';
}
