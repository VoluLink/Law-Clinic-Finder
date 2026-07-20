import Image from 'next/image';
import Link from 'next/link';

import { getDictionary } from '@/lib/i18n/dictionary';
import { getRequestLang } from '@/lib/i18n/get-request-lang';

import { Wordmark } from './Wordmark';

import srLogoWhite from '../../../public/sr-logo-white.png';

/**
 * Site footer for the public pages. Resolves its own language so any server
 * component can drop it in without threading a dictionary through — the
 * "Account" link is the single entry point to /login, so it needs to be
 * reachable from everywhere, not just the landing page.
 */
export async function Footer() {
  const dict = getDictionary(await getRequestLang());
  const linkClasses = 'text-primary-foreground/70 hover:text-primary-foreground';
  return (
    <footer className="bg-primary py-11 text-primary-foreground">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-4" aria-label={dict.cooperation}>
          <Image src={srLogoWhite} alt="Start Right" className="h-[34px] w-auto" />
          <span aria-hidden className="text-[22px] text-primary-foreground/50">
            ×
          </span>
          <Wordmark variant="light" size="sm" />
          <span className="ms-2 text-[15px] text-primary-foreground/60">
            © 2026 Law Clinics Deutschland e.V.
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/datenschutz" className={linkClasses}>
            {dict.footerPrivacy}
          </Link>
          <Link href="/impressum" className={linkClasses}>
            {dict.footerImprint}
          </Link>
          <Link href="/login" className={linkClasses}>
            {dict.footerAccount}
          </Link>
        </div>
      </div>
    </footer>
  );
}
