'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { GA_MEASUREMENT_ID, readConsent, updateAnalyticsConsent } from '@/lib/analytics/consent';

/**
 * GA4 with Consent Mode v2: analytics storage defaults to denied, and only the
 * ConsentBanner flips it to granted. Renders nothing without a measurement id.
 */
export function Analytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const analyticsAllowed = pathname !== '/auth/confirm';
  useEffect(() => {
    if (!analyticsAllowed) return;
    const consent = readConsent();
    if (consent) updateAnalyticsConsent(consent);
  }, [analyticsAllowed]);

  if (!GA_MEASUREMENT_ID || !analyticsAllowed) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      {/* Consent default (denied) is pushed before config, so nothing is
          collected until the ConsentBanner grants it. */}
      <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;` +
          `gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});` +
          `gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
