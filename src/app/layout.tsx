import type { Metadata } from 'next';
import { Hanken_Grotesk, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

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
  const lang = await getRequestLang();
  return (
    <html
      lang={lang}
      dir={dirFor(lang)}
      className={`${hankenGrotesk.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
