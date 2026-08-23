import { LEGAL_AREAS, REGION_SUGGESTIONS } from '@/lib/clinics/options';

import type { ChatMessage } from './schema';

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const OBFUSCATED_EMAIL_PATTERN =
  /[\p{L}\d._%+-]+\s*(?:\(\s*(?:at|ät)\s*\)|\[\s*(?:at|ät)\s*\])\s*[\p{L}\d.-]+\s*(?:\(\s*(?:dot|punkt)\s*\)|\[\s*(?:dot|punkt)\s*\])\s*[\p{L}]{2,}/giu;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/gi;
const IBAN_MIN_LENGTH = 15;
const IBAN_MAX_LENGTH = 34;
// 'A'.charCodeAt(0) - 10, so A..Z map onto the 10..35 required by ISO 13616.
const IBAN_LETTER_OFFSET = 55;
const IBAN_LENGTHS: Record<string, number | undefined> = {
  AT: 20,
  BE: 16,
  CH: 21,
  CZ: 24,
  DE: 22,
  DK: 18,
  ES: 24,
  FR: 27,
  GB: 22,
  HU: 28,
  IT: 27,
  LI: 21,
  LU: 20,
  NL: 18,
  PL: 28,
  PT: 25,
  SE: 24,
  TR: 26,
};
const CREDIT_CARD_PATTERN = /(?<!\d)(?<!\d[.,])\d(?:[ -]?\d){12,18}(?!\d)(?![.,]\d)/g;
const CREDIT_CARD_MIN_DIGITS = 13;
const CREDIT_CARD_MAX_DIGITS = 19;
const CREDIT_CARD_MIN_GROUP = 3;
const CREDIT_CARD_MAX_GROUP = 6;
const TAX_ID_PATTERN = /(?<!\d)(?<!\d[.,])\d{2} ?\d{3} ?\d{3} ?\d{3}(?!\d)(?![.,]\d)/g;
const TAX_ID_PREFIX_LENGTH = 10;
const TAX_ID_MAX_REPEATS = 3;
const SOCIAL_INSURANCE_PATTERN =
  /(?<![\dA-Za-z])\d{2} ?(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2} ?[A-Z] ?\d{2} ?\d(?![\dA-Za-z])/g;
const BIRTH_DATE_MARKER = String.raw`(?:geboren\s+am|geboren|geb\.|Geburtsdatum|Geburtstag)`;
const WRITTEN_DATE = String.raw`\d{1,2}\.\s?\p{L}+\s+\d{4}`;
const NUMERIC_DATE = String.raw`\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}`;
const BIRTH_DATE_PATTERN = new RegExp(
  String.raw`\b(${BIRTH_DATE_MARKER}\s*:?\s*)(${WRITTEN_DATE}|${NUMERIC_DATE})`,
  'giu',
);
// Chamber number (arabic or roman), register letters, running number, filing year.
const COURT_CASE_NUMBER_PATTERN =
  /\b(?:[IVX]{1,5}|\d{1,3}) ?[A-Z][A-Za-z]{0,3} ?\d{1,5}\/\d{2,4}\b/g;
// The lookahead keeps "Az. ist noch nicht vergeben" intact: the token must carry a digit.
const MARKED_CASE_NUMBER_PATTERN =
  /\b((?:Aktenzeichen|Gesch(?:äfts|aefts)zeichen|Az\.?)\s*:?\s+)((?=[\w./-]*\d)\w+(?:[./-]\w+)*)/g;
// German plates never carry a leading zero in the running number.
const LICENCE_PLATE_PATTERN = /\b([A-ZÄÖÜ]{1,3})-[A-ZÄÖÜ]{1,2} ?[1-9]\d{0,3}(?: ?[EH])?\b/g;
const NON_PLATE_PREFIXES = new Set(['DIN', 'EN', 'ISO', 'EG', 'EU', 'UN', 'ICD', 'GG']);
const CITY_CORE = String.raw`\p{Lu}[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)*`;
const CITY_PREFIX = String.raw`(?:(?:Bad|Sankt|St\.|Neu|Alt|Gro(?:ß|ss)|Klein|Ober|Unter|Nieder|Hohen)\s)?`;
const CITY_SUFFIX = String.raw`(?:\s(?:am|an\sder|im|ob\sder)\s${CITY_CORE})?`;
const POSTAL_CODE_CITY_PATTERN = new RegExp(
  String.raw`(?<!\d)(?<!\d[.,])(\d{5})\s(${CITY_PREFIX}${CITY_CORE}${CITY_SUFFIX})(?!\p{L})`,
  'gu',
);
const NON_CITY_WORDS = new Set([
  'Anteile',
  'Beschäftigte',
  'Einwohner',
  'Euro',
  'Exemplare',
  'Fälle',
  'Jahre',
  'Kilometer',
  'Kunden',
  'Menschen',
  'Meter',
  'Mieter',
  'Mio',
  'Mitarbeiter',
  'Mitglieder',
  'Monate',
  'Mrd',
  'Personen',
  'Prozent',
  'Quadratmeter',
  'Stunden',
  'Stück',
  'Tage',
  'Teilnehmer',
  'Wohnungen',
]);
// Serial characters of German ID documents exclude the vowel-like letters A, B, D, E, I, O, Q, S, U.
const ID_DOCUMENT_CHARACTER = '[0-9CFGHJKLMNPRTVWXYZ]';
const ID_DOCUMENT_PATTERN = new RegExp(
  String.raw`\b[LMNPRTVWXY]${ID_DOCUMENT_CHARACTER}{8}\b`,
  'g',
);
const MARKED_ID_DOCUMENT_PATTERN =
  /\b((?:Personalausweis|Ausweis|Reisepass|Pass)(?:nummer)?(?:[\s-]?Nr\.?)?\s*:?\s+)((?=[A-Z0-9]*\d)[A-Z0-9]{8,10})\b/g;
const MIN_ID_DOCUMENT_DIGITS = 4;
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

function ibanRemainder(compact: string): number {
  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const expanded = /\d/.test(character)
      ? character
      : String(character.charCodeAt(0) - IBAN_LETTER_OFFSET);
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

function isValidIban(candidate: string): boolean {
  const compact = candidate.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact)) return false;
  const expectedLength = IBAN_LENGTHS[compact.slice(0, 2)];
  if (expectedLength !== undefined)
    return compact.length === expectedLength && ibanRemainder(compact) === 1;
  if (compact.length < IBAN_MIN_LENGTH || compact.length > IBAN_MAX_LENGTH) return false;
  return ibanRemainder(compact) === 1;
}

// The pattern may swallow trailing words, so shrink the candidate until mod-97 holds.
function redactIban(candidate: string): string {
  for (let end = candidate.length; end >= IBAN_MIN_LENGTH; end -= 1) {
    if (!/[A-Za-z0-9]/.test(candidate.charAt(end - 1))) continue;
    if (isValidIban(candidate.slice(0, end))) return `[IBAN]${candidate.slice(end)}`;
  }
  return candidate;
}

function isValidLuhn(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits.charAt(digits.length - 1 - index));
    const weighted = index % 2 === 1 ? digit * 2 : digit;
    sum += weighted > 9 ? weighted - 9 : weighted;
  }
  return sum % 10 === 0;
}

// Printed card numbers group in blocks of 4 to 6; anything else is a run of unrelated digits.
function hasCardGrouping(candidate: string): boolean {
  const groups = candidate.split(/[ -]/);
  return (
    groups.length === 1 ||
    groups.every(
      (group) => group.length >= CREDIT_CARD_MIN_GROUP && group.length <= CREDIT_CARD_MAX_GROUP,
    )
  );
}

function redactCreditCard(candidate: string): string {
  const digits = candidate.replace(/[ -]/g, '');
  if (digits.length < CREDIT_CARD_MIN_DIGITS || digits.length > CREDIT_CARD_MAX_DIGITS) {
    return candidate;
  }
  if (!hasCardGrouping(candidate)) return candidate;
  return isValidLuhn(digits) ? '[KREDITKARTE]' : candidate;
}

// ISO 7064 MOD 11,10 as specified by the Bundeszentralamt für Steuern.
function taxIdCheckDigit(prefix: string): number {
  let product = 10;
  for (const character of prefix) {
    const remainder = (Number(character) + product) % 10;
    product = (2 * (remainder === 0 ? 10 : remainder)) % 11;
  }
  return (11 - product) % 10;
}

// Exactly one of the first ten digits repeats (twice or three times); the rest are unique.
function hasTaxIdDigitDistribution(prefix: string): boolean {
  const counts = new Map<string, number>();
  for (const character of prefix) counts.set(character, (counts.get(character) ?? 0) + 1);
  const repeats = [...counts.values()].filter((count) => count > 1);
  return repeats.length === 1 && repeats[0] <= TAX_ID_MAX_REPEATS;
}

function redactTaxId(candidate: string): string {
  const digits = candidate.replace(/ /g, '');
  const prefix = digits.slice(0, TAX_ID_PREFIX_LENGTH);
  if (prefix.startsWith('0') || !hasTaxIdDigitDistribution(prefix)) return candidate;
  return taxIdCheckDigit(prefix) === Number(digits.charAt(TAX_ID_PREFIX_LENGTH))
    ? '[STEUER-ID]'
    : candidate;
}

function redactLicencePlate(candidate: string, district: string): string {
  return NON_PLATE_PREFIXES.has(district) ? candidate : '[KENNZEICHEN]';
}

/*
 * The city MUST survive. The whole product is matching a person to a law clinic
 * near them, and the model only knows where they are because they wrote it — so
 * removing "Köln" from "50667 Köln" would silently break the core feature while
 * looking like a privacy win. Only the postal code goes: it narrows a person to a
 * few streets, while the city narrows them to a few hundred thousand.
 */
function redactPostalCity(candidate: string, postalCode: string, city: string): string {
  if (postalCode.startsWith('00')) return candidate;
  const [firstWord] = city.split(/[\s-]/);
  return NON_CITY_WORDS.has(firstWord) ? candidate : `[PLZ] ${city}`;
}

function redactIdDocument(candidate: string): string {
  const digitCount = candidate.replace(/\D/g, '').length;
  return digitCount >= MIN_ID_DOCUMENT_DIGITS ? '[AUSWEIS]' : candidate;
}

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

// IBAN first: its digits would otherwise be claimed by the card and tax-id patterns.
function redactFinancialIdentifiers(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[E-MAIL]')
    .replace(OBFUSCATED_EMAIL_PATTERN, '[E-MAIL]')
    .replace(IBAN_PATTERN, redactIban)
    .replace(CREDIT_CARD_PATTERN, redactCreditCard);
}

function redactGovernmentIdentifiers(text: string): string {
  return text
    .replace(SOCIAL_INSURANCE_PATTERN, '[SOZIALVERSICHERUNG]')
    .replace(TAX_ID_PATTERN, redactTaxId)
    .replace(MARKED_ID_DOCUMENT_PATTERN, '$1[AUSWEIS]')
    .replace(ID_DOCUMENT_PATTERN, redactIdDocument);
}

function redactCaseReferences(text: string): string {
  return text
    .replace(COURT_CASE_NUMBER_PATTERN, '[AKTENZEICHEN]')
    .replace(MARKED_CASE_NUMBER_PATTERN, '$1[AKTENZEICHEN]')
    .replace(LICENCE_PLATE_PATTERN, redactLicencePlate);
}

// Birth dates run before the phone pattern so a marked date cannot be read as a number.
function redactContactDetails(text: string): string {
  return text
    .replace(BIRTH_DATE_PATTERN, '$1[GEBURTSDATUM]')
    .replace(PHONE_PATTERN, redactPhone)
    .replace(POSTAL_CODE_CITY_PATTERN, redactPostalCity);
}

export function redactPatterns(text: string): string {
  const identifiers = redactGovernmentIdentifiers(redactFinancialIdentifiers(text));
  return redactNames(redactAddresses(redactContactDetails(redactCaseReferences(identifiers))));
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
