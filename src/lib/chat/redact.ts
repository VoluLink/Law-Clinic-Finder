import { LEGAL_AREAS, REGION_SUGGESTIONS } from '@/lib/clinics/options';

import type { ChatMessage } from './schema';

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const OBFUSCATED_EMAIL_PATTERN =
  /[\p{L}\d._%+-]+\s*(?:\(\s*(?:at|ät)\s*\)|\[\s*(?:at|ät)\s*\])\s*[\p{L}\d.-]+\s*(?:\(\s*(?:dot|punkt)\s*\)|\[\s*(?:dot|punkt)\s*\])\s*[\p{L}]{2,}/giu;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/gi;
const PHONE_PATTERN = /(?<![\p{L}\d])(?:\+\d{1,3}|00\d{1,3}|0)[\d\s./()-]{6,}\d(?![\p{L}\d])/gu;
const DATE_PATTERN = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
const NAME_WORD = String.raw`\p{Lu}[\p{L}\p{M}'’-]*`;
const EXPLICIT_NAME_PATTERN = new RegExp(
  String.raw`\b((?:[Nn]ame\s*:|[Mm]ein Name ist|[Ii]ch hei(?:ß|ss)e|(?:[Dd]ie|[Dd]er|[Mm]eine|[Mm]ein|[Uu]nsere|[Uu]nser)\s+${NAME_WORD}\s+hei(?:ß|ss)t)\s+)(${NAME_WORD}(?:\s+${NAME_WORD}){0,3})`,
  'gu',
);
const SELF_INTRODUCTION_PATTERN = new RegExp(
  String.raw`\b([Ii]ch bin\s+)(${NAME_WORD}(?:\s+${NAME_WORD}){1,3})`,
  'gu',
);
const TITLED_NAME_PATTERN = new RegExp(
  String.raw`\b(?:Herrn?|Frau|Dr\.?|Prof\.?)(?:\s+(?:Dr\.?|Prof\.?))*\s+${NAME_WORD}(?:\s+${NAME_WORD}){0,3}`,
  'gu',
);
const STREET_TYPE = String.raw`(?:[Ss]traße|[Ss]trasse|[Ss]tr\.?|[Ww]eg|[Aa]llee|[Pp]latz|[Gg]asse|[Rr]ing|[Uu]fer|[Dd]amm|[Cc]haussee|[Ss]teig|[Pp]fad|[Mm]arkt)`;
const HOUSE_NUMBER = String.raw`\d{1,4}[a-zA-Z]?(?:\s*[-/]\s*\d{1,4}[a-zA-Z]?)?`;
const STREET_ADDRESS_PATTERN = new RegExp(
  String.raw`\b(?:${NAME_WORD}${STREET_TYPE}|${NAME_WORD}(?:\s+(?:der|des|den|am|an|von|zu|zum|zur|${NAME_WORD})){0,3}\s+${STREET_TYPE})\s+${HOUSE_NUMBER}\b`,
  'gu',
);
const PREPOSITIONAL_ADDRESS_PATTERN = new RegExp(
  String.raw`\b(?:Am|An der|Auf dem|Unter den|Vor dem|Hinter dem)\s+${NAME_WORD}(?:\s+${NAME_WORD}){0,2}\s+${HOUSE_NUMBER}\b`,
  'gu',
);
const PREFIXED_STREET_ADDRESS_PATTERN = new RegExp(
  String.raw`\b${STREET_TYPE}(?:\s+(?:der|des|den|am|an|von|zu|zum|zur|\d{1,2}\.|${NAME_WORD})){0,4}\s+${HOUSE_NUMBER}\b`,
  'gu',
);

export type RedactionOutcome = {
  status: 'ok';
  transcript: ChatMessage[];
  legalArea: string | null;
  city: string | null;
};

function redactPhone(candidate: string): string {
  const compact = candidate.replace(/[\s()]/g, '');
  if (DATE_PATTERN.test(compact)) return candidate;
  const digitCount = candidate.replace(/\D/g, '').length;
  return digitCount >= 7 && digitCount <= 15 ? '[TELEFON]' : candidate;
}

function redactNames(text: string): string {
  return text
    .replace(EXPLICIT_NAME_PATTERN, '$1[NAME]')
    .replace(SELF_INTRODUCTION_PATTERN, '$1[NAME]')
    .replace(TITLED_NAME_PATTERN, '[NAME]');
}

function redactAddresses(text: string): string {
  return text
    .replace(PREPOSITIONAL_ADDRESS_PATTERN, '[ADRESSE]')
    .replace(PREFIXED_STREET_ADDRESS_PATTERN, '[ADRESSE]')
    .replace(STREET_ADDRESS_PATTERN, '[ADRESSE]');
}

export function redactPatterns(text: string): string {
  return redactNames(
    redactAddresses(
      text
        .replace(EMAIL_PATTERN, '[E-MAIL]')
        .replace(OBFUSCATED_EMAIL_PATTERN, '[E-MAIL]')
        .replace(IBAN_PATTERN, '[IBAN]')
        .replace(PHONE_PATTERN, redactPhone),
    ),
  );
}

function userText(transcript: ChatMessage[]): string {
  return transcript
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');
}

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

export async function redactTranscript(transcript: ChatMessage[]): Promise<RedactionOutcome> {
  const originalUserText = userText(transcript);
  return {
    status: 'ok',
    transcript: transcript.map((message) => ({
      role: message.role,
      content: redactPatterns(message.content),
    })),
    legalArea: findLegalArea(originalUserText),
    city: findCity(originalUserText),
  };
}
