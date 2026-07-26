import { describe, expect, it } from 'vitest';

import type { Dictionary } from '../dictionary';
import { de } from './de';
import { fa } from './fa';
import { fr } from './fr';
import { ku } from './ku';
import { ru } from './ru';
import { tr } from './tr';
import { uk } from './uk';

type RegisterGuard = {
  dict: Dictionary;
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
    dict: de,
    formalWords: ['Sie', 'Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres', 'Ihnen'],
    caseSensitive: true,
  },
  fr: { dict: fr, formalWords: ['vous', 'votre', 'vos', 'veuillez'] },
  ru: {
    dict: ru,
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
    dict: uk,
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
    dict: tr,
    formalWords: ['siz', 'sizin', 'size', 'sizi', 'sizden', 'sizler'],
    formalSuffix: /(ınız|iniz|unuz|ünüz|sınız|siniz|sunuz|sünüz)$/u,
  },
  fa: { dict: fa, formalWords: ['شما'] },
  ku: { dict: ku, formalWords: ['hûn', 'we', 'hûne'] },
};

function wordsOf(dict: Dictionary, caseSensitive: boolean): string[] {
  const joined = Object.values(dict).join(' ');
  const normalized = caseSensitive ? joined : joined.toLowerCase();
  return normalized.split(/[^\p{L}]+/u).filter(Boolean);
}

describe('locale register: informal address only', () => {
  for (const [lang, guard] of Object.entries(GUARDS)) {
    it(`${lang} uses no formal second-person forms`, () => {
      const words = wordsOf(guard.dict, guard.caseSensitive ?? false);
      const forbidden = new Set(guard.formalWords);
      const found = words.filter(
        (word) => forbidden.has(word) || (guard.formalSuffix?.test(word) ?? false),
      );
      expect(found).toEqual([]);
    });
  }
});
