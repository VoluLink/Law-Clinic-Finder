import type { Metadata } from 'next';
import { Hanken_Grotesk, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

import { Analytics } from '@/components/analytics/Analytics';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { brandingCssVars, googleFontHref } from '@/lib/branding/branding';
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
  title: 'Law Clinic Finder',
  description:
    'Kostenlose studentische Rechtsberatung in Deutschland finden – ' +
    'der Law Clinic Finder vermittelt die passende Law Clinic für Ihr Anliegen.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, branding] = await Promise.all([getRequestLang(), getBranding()]);
  const fontHref = googleFontHref(branding.font);
  return (
    <html
      lang={lang}
      dir={dirFor(lang)}
      className={`${hankenGrotesk.variable} ${notoSansArabic.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <head>
        {fontHref && <link rel="stylesheet" href={fontHref} />}
        {/* Runtime :root token overrides from the admin Branding tab. */}
        <style dangerouslySetInnerHTML={{ __html: brandingCssVars(branding) }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics />
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
