'use client';

import Script from 'next/script';
import { useEffect } from 'react';

import { GA_MEASUREMENT_ID, readConsent, updateAnalyticsConsent } from '@/lib/analytics/consent';

/**
 * GA4 with Consent Mode v2: analytics storage defaults to denied, and only the
 * ConsentBanner flips it to granted. Renders nothing without a measurement id.
 */
export function Analytics() {
  useEffect(() => {
    const consent = readConsent();
    if (consent) updateAnalyticsConsent(consent);
  }, []);

  if (!GA_MEASUREMENT_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      {/* Consent default (denied) is pushed before config, so nothing is
          collected until the ConsentBanner grants it. */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;` +
          `gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});` +
          `gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
