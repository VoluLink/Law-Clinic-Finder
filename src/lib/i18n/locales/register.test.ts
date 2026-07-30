import { describe, expect, it } from 'vitest';

import { getDictionary } from '../dictionary';
import { fa } from './fa';
import { fr } from './fr';
import { ku } from './ku';
import { ru } from './ru';
import { tr } from './tr';
import { uk } from './uk';

type RegisterGuard = {
  strings: Record<string, string>;
  // Formal second-person pronouns/possessives that must never appear.
  formalWords: string[];
  // Optional formal verb/possessive suffixes (Turkish -ınız / -siniz family).
  formalSuffix?: RegExp;
  // German "Sie/Ihr" are formal only when capitalized (lowercase = they/her),
  // so that language is matched case-sensitively; the rest are lowercased.
  caseSensitive?: boolean;
};

// Every language with a T–V (informal/formal) distinction addresses the reader
// only in the informal register — see the site-copy convention. Arabic and
// English have no such pronoun split and are therefore not guarded here.
const GUARDS: Record<string, RegisterGuard> = {
  de: {
    // The German-only landing copy ships to every locale, so it is guarded here.
    strings: getDictionary('de'),
    formalWords: ['Sie', 'Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres', 'Ihnen'],
    caseSensitive: true,
  },
  fr: { strings: fr, formalWords: ['vous', 'votre', 'vos', 'veuillez'] },
  ru: {
    strings: ru,
    formalWords: [
      'вы',
      'вас',
      'вам',
      'вами',
      'ваш',
      'ваша',
      'ваше',
      'ваши',
      'ваших',
      'вашего',
      'вашей',
      'вашею',
      'вашу',
      'вашим',
      'вашими',
    ],
  },
  uk: {
    strings: uk,
    formalWords: [
      'ви',
      'вас',
      'вам',
      'вами',
      'ваш',
      'ваша',
      'ваше',
      'ваші',
      'ваших',
      'вашого',
      'вашої',
      'вашу',
      'вашим',
      'вашими',
    ],
  },
  tr: {
    strings: tr,
    formalWords: ['siz', 'sizin', 'size', 'sizi', 'sizden', 'sizler'],
    formalSuffix: /(ınız|iniz|unuz|ünüz|sınız|siniz|sunuz|sünüz)$/u,
  },
  fa: { strings: fa, formalWords: ['شما'] },
  ku: { strings: ku, formalWords: ['hûn', 'we', 'hûne'] },
};

function wordsOf(strings: Record<string, string>, caseSensitive: boolean): string[] {
  const joined = Object.values(strings).join(' ');
  const normalized = caseSensitive ? joined : joined.toLowerCase();
  return normalized.split(/[^\p{L}]+/u).filter(Boolean);
}

describe('locale register: informal address only', () => {
  for (const [lang, guard] of Object.entries(GUARDS)) {
    it(`${lang} uses no formal second-person forms`, () => {
      const words = wordsOf(guard.strings, guard.caseSensitive ?? false);
      const forbidden = new Set(guard.formalWords);
      const found = words.filter(
        (word) => forbidden.has(word) || (guard.formalSuffix?.test(word) ?? false),
      );
      expect(found).toEqual([]);
    });
  }
});
