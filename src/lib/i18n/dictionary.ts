import type { Lang } from './config';
import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { fa } from './locales/fa';
import { fr } from './locales/fr';
import { ku } from './locales/ku';
import { ru } from './locales/ru';
import { tr } from './locales/tr';
import { uk } from './locales/uk';

/**
 * All public-flow strings (landing page + chat widget). Every locale file must
 * provide every key — enforced by this type, so there is no runtime
 * completeness check.
 */
export type Dictionary = {
  navSo: string;
  navFaq: string;
  navCta: string;
  langLabel: string;
  heroTitle: string;
  heroSub: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchBtn: string;
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
  faqHeading: string;
  faqSub: string;
  faq1Q: string;
  faq1A: string;
  faq2Q: string;
  faq2A: string;
  faq3Q: string;
  faq3A: string;
  faq4Q: string;
  faq4A: string;
  faq5Q: string;
  faq5A: string;
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
  privacyNote: string;
  limitMinuteTitle: string;
  limitMinuteBody: string;
  limitDailyTitle: string;
  limitDailyBody: string;
  charWarn: string;
  noMatchTitle: string;
  noMatchStep1: string;
  noMatchStep2: string;
  noMatchStep3: string;
  noMatchBtnRestart: string;
};

const DICTIONARIES: Record<Lang, Dictionary> = { de, en, ar, fr, ku, fa, ru, uk, tr };

export function getDictionary(lang: Lang): Dictionary {
  return DICTIONARIES[lang];
}
