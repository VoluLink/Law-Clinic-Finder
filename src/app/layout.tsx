import type { Metadata } from 'next';
import { Hanken_Grotesk, Noto_Sans_Arabic } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

import { Analytics } from '@/components/analytics/Analytics';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { brandingCssVars, brandingFontFaces } from '@/lib/branding/branding';
import { getBranding } from '@/lib/branding/server';
import { dirFor } from '@/lib/i18n/config';
import { getRequestLang } from '@/lib/i18n/get-request-lang';

const hankenGrotesk = Hanken_Grotesk({
  variable: '--font-hanken-grotesk',
  subsets: ['latin', 'latin-ext'],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: '--font-noto-arabic',
  subsets: ['arabic'],
});

export const metadata: Metadata = {
  title: 'Kostenlose Rechtsberatung | Law Clinic Finder',
  description:
    'Kostenlose studentische Rechtsberatung in Deutschland finden – ' +
    'der Law Clinic Finder vermittelt die passende Law Clinic für Ihr Anliegen.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, branding, requestHeaders] = await Promise.all([
    getRequestLang(),
    getBranding(),
    headers(),
  ]);
  const fontFaces = brandingFontFaces(branding.font);
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  return (
    <html
      lang={lang}
      dir={dirFor(lang)}
      className={`${hankenGrotesk.variable} ${notoSansArabic.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <head>
        {/* Runtime :root token overrides from the admin Branding tab, plus the
            self-hosted faces for the font it selected. Both are generated from
            validated values — a hex-only colour and an enum'd family name. */}
        <style
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: (fontFaces ?? '') + brandingCssVars(branding) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics nonce={nonce} />
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
