'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  GA_MEASUREMENT_ID,
  readConsent,
  updateAnalyticsConsent,
  writeConsent,
  type Consent,
} from '@/lib/analytics/consent';

/** GDPR cookie-consent gate for analytics — shown until the visitor decides. */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Client-only cookie read on mount — SSR can't see cookies, so visibility
    // is resolved once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (GA_MEASUREMENT_ID) setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  function choose(consent: Consent) {
    writeConsent(consent);
    updateAnalyticsConsent(consent);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einwilligung"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-4 shadow-panel"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Wir nutzen anonyme Statistik (Google Analytics), um den Finder zu verbessern – nur mit
          deiner Einwilligung. Mehr in der{' '}
          <Link href="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => choose('denied')}>
            Ablehnen
          </Button>
          <Button onClick={() => choose('granted')}>Einverstanden</Button>
        </div>
      </div>
    </div>
  );
}
