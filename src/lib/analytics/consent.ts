export const CONSENT_COOKIE = 'lcf_consent';
export type Consent = 'granted' | 'denied';

/** The public GA4 id; when unset, no tracking or banner is rendered. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )lcf_consent=(granted|denied)/);
  return match ? (match[1] as Consent) : null;
}

export function writeConsent(consent: Consent): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${consent}; path=/; max-age=${oneYear}; samesite=lax`;
}

type Gtag = (...args: unknown[]) => void;

/** Google Consent Mode v2 update — analytics storage follows the user's choice. */
export function updateAnalyticsConsent(consent: Consent): void {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  gtag?.('consent', 'update', { analytics_storage: consent });
}
