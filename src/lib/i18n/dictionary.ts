import type { Lang } from './config';
import { ar } from './locales/ar';
import { de, deOnly } from './locales/de';
import { en } from './locales/en';
import { fa } from './locales/fa';
import { fr } from './locales/fr';
import { ku } from './locales/ku';
import { ru } from './locales/ru';
import { tr } from './locales/tr';
import { uk } from './locales/uk';

/**
 * Strings every locale provides itself. Each locale file must cover all of
 * them — enforced by this type, so there is no runtime completeness check.
 */
export type Translations = {
  navSo: string;
  navFaq: string;
  navCta: string;
  langLabel: string;
  heroTitle: string;
  heroSub: string;
  searchLabel: string;
  searchBtn: string;
  faqHeading: string;
  faqCostQ: string;
  faqCostA: string;
  faqConfidentialQ: string;
  faqConfidentialA: string;
  faqCourtQ: string;
  faqCourtA: string;
  footerPrivacy: string;
  footerImprint: string;
  footerAccount: string;
  cooperation: string;
  assistantName: string;
  assistantTag: string;
  chatYou: string;
  whyFits: string;
  toWebsite: string;
  recFooter: string;
  saveRecommendations: string;
  saveRecommendationsDescription: string;
  downloadPdf: string;
  copyText: string;
  copiedText: string;
  pdfPreparing: string;
  exportError: string;
  exportTitle: string;
  exportConcern: string;
  exportGeneratedOn: string;
  exportAreas: string;
  exportWebsite: string;
  exportEmail: string;
  exportFindMore: string;
  chatPlaceholder: string;
  chatSend: string;
  chatError: string;
  chatDisabled: string;
  chatUnavailableTitle: string;
  limitMinuteTitle: string;
  limitMinuteBody: string;
  limitDailyTitle: string;
  limitDailyBody: string;
  charWarn: string;
  chatCompletedTitle: string;
  chatCompletedDescription: string;
  chatCompletedBtnRestart: string;
  noMatchResultTitle: string;
  noMatchTitle: string;
  noMatchStep1: string;
  noMatchStep2: string;
  noMatchStep3: string;
  noMatchBtnDirectory: string;
  noMatchBtnRestart: string;
};

/**
 * Strings that stay German in every language: the sections explaining this site
 * and student legal advice. Locale files cannot declare them, so a translation
 * can never silently shadow the single German wording in `deOnly`.
 */
export type GermanOnly = {
  searchPlaceholder: string;
  aiDisclaimer: string;
  soHeading: string;
  soIntro: string;
  step1Title: string;
  step1Text: string;
  step2Title: string;
  step2Text: string;
  step3Title: string;
  step3Text: string;
  step4Title: string;
  step4Text: string;
  faqSub: string;
  faqWhatIsQ: string;
  faqWhatIsA: string;
  faqWhoAdvisesQ: string;
  faqWhoAdvisesA: string;
  faqWhyStudentsQ: string;
  faqWhyStudentsA: string;
  faqWhoBenefitsQ: string;
  faqWhoBenefitsA: string;
};

/** All public-flow strings (landing page + chat widget). */
export type Dictionary = Translations & GermanOnly;

const DICTIONARIES: Record<Lang, Dictionary> = {
  de: { ...de, ...deOnly },
  en: { ...en, ...deOnly },
  ar: { ...ar, ...deOnly },
  fr: { ...fr, ...deOnly },
  ku: { ...ku, ...deOnly },
  fa: { ...fa, ...deOnly },
  ru: { ...ru, ...deOnly },
  uk: { ...uk, ...deOnly },
  tr: { ...tr, ...deOnly },
};

export function getDictionary(lang: Lang): Dictionary {
  return DICTIONARIES[lang];
}
