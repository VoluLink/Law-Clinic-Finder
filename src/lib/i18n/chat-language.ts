import { isRtl, LANGS, type Lang } from './config';
import { getDictionary, type Dictionary } from './dictionary';

type ChatPresentation = { dict: Dictionary; lang: Lang; rtl: boolean };

const LANGUAGE_WORDS: Readonly<Record<Lang, readonly string[]>> = {
  de: [
    'ich',
    'und',
    'mit',
    'hilfe',
    'brauche',
    'miete',
    'mietrecht',
    'mietvertrag',
    'wohnung',
    'meine',
    'frage',
    'mietproblem',
    'köln',
    'anliegen',
    'treffer',
    'schnell',
    'getippt',
  ],
  en: ['need', 'help', 'with', 'tenancy', 'rental', 'rent', 'agreement', 'housing'],
  ar: ['أحتاج', 'مساعدة', 'بشأن', 'الإيجار', 'عقد', 'سكن'],
  fr: ['besoin', 'aide', 'avec', 'bail', 'loyer', 'logement', 'contrat'],
  ku: ['ez', 'alîkariya', 'alîkarî', 'ji', 'bo', 'kirê', 'dixwazim'],
  fa: ['برای', 'اجاره', 'کمک', 'نیاز', 'دارم', 'قرارداد'],
  ru: ['мне', 'нужна', 'помощь', 'арендой', 'аренда', 'договор', 'жилье'],
  uk: ['мені', 'потрібна', 'допомога', 'орендою', 'оренда', 'договір', 'житло'],
  tr: ['yardıma', 'ihtiyacım', 'kirayla', 'ilgili', 'yardım', 'kira', 'sözleşme'],
};

/** Picks a chat-only locale locally; unknown languages intentionally use English. */
export function resolveChatPresentation(text: string): ChatPresentation {
  const lang = detectPresetLanguage(text) ?? 'en';
  return { dict: getDictionary(lang), lang, rtl: isRtl(lang) };
}

function detectPresetLanguage(text: string): Lang | null {
  const words = text.toLocaleLowerCase().match(/\p{L}+/gu) ?? [];
  let result: Lang | null = null;
  let bestScore = 0;
  for (const { code } of LANGS) {
    const score = scoreLanguage(words, LANGUAGE_WORDS[code]);
    if (score > bestScore) [result, bestScore] = [code, score];
  }
  return result;
}

function scoreLanguage(words: string[], languageWords: readonly string[]): number {
  return words.reduce((score, word) => score + Number(languageWords.includes(word)), 0);
}
