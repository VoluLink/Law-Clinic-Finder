import { z } from 'zod';

export const langSchema = z.enum(['de', 'en', 'ar', 'fr', 'ku', 'fa', 'ru', 'uk', 'tr']);

export type Lang = z.infer<typeof langSchema>;

export const DEFAULT_LANG: Lang = 'de';

export const LANG_COOKIE = 'lcf_lang';

/** Display metadata for the language switcher, in the design's menu order. */
export const LANGS: readonly { code: Lang; native: string; short: string }[] = [
  { code: 'de', native: 'Deutsch', short: 'DE' },
  { code: 'en', native: 'English', short: 'EN' },
  { code: 'ar', native: 'العربية', short: 'AR' },
  { code: 'fr', native: 'Français', short: 'FR' },
  { code: 'ku', native: 'Kurdî', short: 'KU' },
  { code: 'fa', native: 'فارسی', short: 'FA' },
  { code: 'ru', native: 'Русский', short: 'RU' },
  { code: 'uk', native: 'Українська', short: 'UK' },
  { code: 'tr', native: 'Türkçe', short: 'TR' },
];

const RTL_LANGS: ReadonlySet<Lang> = new Set(['ar', 'fa']);

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.has(lang);
}

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return isRtl(lang) ? 'rtl' : 'ltr';
}
