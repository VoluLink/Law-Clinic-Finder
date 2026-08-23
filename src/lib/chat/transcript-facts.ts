import { LEGAL_AREAS, REGION_SUGGESTIONS } from '@/lib/clinics/options';

import type { ChatMessage } from './schema';

/**
 * Reads the two facts the admin statistics need out of a transcript that has
 * already passed the de-identification boundary in `@/lib/security/deidentify`.
 *
 * This module deliberately does no redaction. It used to, back when a local
 * regex engine was the redactor; Cloud DLP owns that now, and the only thing
 * left here is allow-list classification against the finder's own vocabulary —
 * which matches words the visitor chose, and never removes any.
 */
export type TranscriptFacts = {
  status: 'ok' | 'failed';
  transcript: ChatMessage[];
  legalArea: string | null;
  city: string | null;
};

function userText(transcript: ChatMessage[]): string {
  return transcript
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
}

/** Longest first, so "Mietrecht und Wohnungseigentum" wins over "Mietrecht". */
function findLegalArea(text: string): string | null {
  const normalized = text.toLocaleLowerCase('de-DE');
  return (
    [...LEGAL_AREAS]
      .sort((left, right) => right.length - left.length)
      .find((area) => normalized.includes(area.toLocaleLowerCase('de-DE'))) ?? null
  );
}

function findCity(text: string): string | null {
  return (
    [...REGION_SUGGESTIONS]
      .sort((left, right) => right.length - left.length)
      .find((region) => text.includes(region)) ?? null
  );
}

export async function readTranscriptFacts(transcript: ChatMessage[]): Promise<TranscriptFacts> {
  const text = userText(transcript);
  return {
    status: 'ok',
    transcript,
    legalArea: findLegalArea(text),
    city: findCity(text),
  };
}
