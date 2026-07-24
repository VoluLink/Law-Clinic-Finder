'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import { FIELD_HELP } from '@/lib/clinics/field-help';

type AdviceFieldProps = {
  advises: boolean;
  description: string;
  onAdvisesChange: (advises: boolean) => void;
  onDescriptionChange: (value: string) => void;
  error?: string;
};

/**
 * Beratungsarbeit: a Ja/Nein toggle plus a text field. When the clinic does not
 * advise clients individually, the text explains the alternative service and is
 * required (validated on save); when it does, the same text is an optional
 * description. Both write to the clinic's `description`.
 */
export function AdviceField({
  advises,
  description,
  onAdvisesChange,
  onDescriptionChange,
  error,
}: AdviceFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        Beratungsarbeit
        {FIELD_HELP.advises_clients && (
          <InfoHint text={FIELD_HELP.advises_clients} label="Beratungsarbeit" />
        )}
      </legend>
      <Toggle
        label={
          advises
            ? 'Wir beraten Mandant:innen individuell.'
            : 'Wir bieten keine individuelle Beratung an.'
        }
        checked={advises}
        onChange={(event) => onAdvisesChange(event.target.checked)}
      />
      <Textarea
        label={
          advises
            ? 'Beschreibung deiner Beratungsarbeit (optional)'
            : 'Welche Leistung bietest du stattdessen an?'
        }
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        hint={FIELD_HELP.description}
        required={!advises}
        error={error}
        placeholder={
          advises
            ? 'Kurz beschreiben, wie du berätst…'
            : 'z. B. Wir erarbeiten abstrakte Projekte statt Einzelfallberatung.'
        }
      />
    </fieldset>
  );
}
