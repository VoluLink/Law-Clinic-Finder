import Link from 'next/link';

import { ChatUnavailable } from '@/components/chat/ChatUnavailable';
import { FinderChat } from '@/components/chat/FinderChat';
import { FaqAccordion } from '@/components/layout/FaqAccordion';
import { Footer } from '@/components/layout/Footer';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Wordmark } from '@/components/layout/Wordmark';
import { isRtl, type Lang } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionary';
import { getRequestLang } from '@/lib/i18n/get-request-lang';
import { loadChatSettings } from '@/lib/settings';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type ChatLanding = { available: boolean; greeting: string };

/**
 * The landing page needs the greeting and whether the assistant is live. `anon`
 * cannot read the settings table, so this uses the service-role client.
 * `available` mirrors the chat route's 503 conditions (env keys present, the
 * settings fully configured, AND `chat_enabled`); a missing setting or unreachable
 * database degrades to unavailable rather than throwing, so the page shows the
 * notice instead of a broken chat.
 */
async function loadChatLanding(): Promise<ChatLanding> {
  const configured =
    Boolean(process.env.SUPABASE_SECRET_KEY) && Boolean(process.env.ANTHROPIC_API_KEY);
  if (!configured) return { available: false, greeting: '' };
  try {
    const loaded = await loadChatSettings(createSupabaseAdminClient());
    if (!loaded.ok) return { available: false, greeting: '' };
    return { available: loaded.settings.chat_enabled, greeting: loaded.settings.chat_greeting };
  } catch {
    return { available: false, greeting: '' };
  }
}

export default async function Home() {
  const lang = await getRequestLang();
  const dict = getDictionary(lang);
  const chat = await loadChatLanding();
  return (
    <div className="flex flex-1 flex-col">
      <Nav dict={dict} lang={lang} />
      <main className="flex-1">
        <Hero
          dict={dict}
          lang={lang}
          rtl={isRtl(lang)}
          available={chat.available}
          greeting={chat.greeting}
        />
        <StepsSection dict={dict} />
        <FaqSection dict={dict} />
      </main>
      <Footer />
    </div>
  );
}

const CONTAINER = 'mx-auto w-full max-w-[1180px] px-5 sm:px-8';

function Nav({ dict, lang }: { dict: Dictionary; lang: Lang }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-primary/10 bg-background/90 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-[78px] items-center justify-between`}>
        <Link href="#top" aria-label="Law Clinics Deutschland">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <a href="#so" className="hidden text-[15px] font-semibold text-primary md:inline">
            {dict.navSo}
          </a>
          <a href="#faq" className="hidden text-[15px] font-semibold text-primary md:inline">
            {dict.navFaq}
          </a>
          <Link
            href="/signup"
            className="hidden rounded-full border-[1.5px] border-primary/20 px-4.5 py-2 text-[15px] font-bold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:inline"
          >
            {dict.navCta}
          </Link>
          <LanguageSwitcher current={lang} label={dict.langLabel} />
        </div>
      </div>
    </nav>
  );
}

function Hero({
  dict,
  lang,
  rtl,
  available,
  greeting,
}: {
  dict: Dictionary;
  lang: Lang;
  rtl: boolean;
  available: boolean;
  greeting: string;
}) {
  return (
    <section id="top" className="pt-12 pb-10 sm:pt-[72px]">
      <div className={CONTAINER}>
        <div className="mx-auto max-w-[760px] text-center">
          <div className="mb-4 text-sm font-bold tracking-[0.16em] text-primary/65 uppercase">
            Law Clinic Finder
          </div>
          <h1 className="text-[clamp(38px,5vw,64px)] leading-[1.04] font-extrabold tracking-tight text-primary">
            {dict.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-[600px] text-xl leading-relaxed text-muted">
            {dict.heroSub}
          </p>
        </div>
        <div className="mt-10">
          {available ? (
            <FinderChat dict={dict} lang={lang} rtl={rtl} greeting={greeting} />
          ) : (
            <ChatUnavailable dict={dict} />
          )}
        </div>
      </div>
    </section>
  );
}

function StepsSection({ dict }: { dict: Dictionary }) {
  const steps = [
    { n: '1', title: dict.step1Title, text: dict.step1Text },
    { n: '2', title: dict.step2Title, text: dict.step2Text },
    { n: '3', title: dict.step3Title, text: dict.step3Text },
    { n: '4', title: dict.step4Title, text: dict.step4Text },
  ];
  return (
    <section id="so" className="mt-12 bg-primary py-14 text-primary-foreground sm:py-[90px]">
      <div className={CONTAINER}>
        <div className="max-w-[680px]">
          <h2 className="text-[clamp(30px,4vw,44px)] leading-[1.08] font-extrabold tracking-tight">
            {dict.soHeading}
          </h2>
          <p className="mt-4 text-[19px] leading-relaxed text-primary-foreground/80">
            {dict.soIntro}
          </p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {steps.map((step) => (
            <div key={step.n}>
              <div className="text-[46px] leading-none font-extrabold text-primary-foreground/30">
                {step.n}
              </div>
              <h3 className="mt-3.5 mb-2 text-[19px] font-bold">{step.title}</h3>
              <p className="text-[15px] leading-relaxed text-primary-foreground/80">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ dict }: { dict: Dictionary }) {
  const items = [
    { question: dict.faq1Q, answer: dict.faq1A },
    { question: dict.faq2Q, answer: dict.faq2A },
    { question: dict.faq3Q, answer: dict.faq3A },
    { question: dict.faq4Q, answer: dict.faq4A },
    { question: dict.faq5Q, answer: dict.faq5A },
  ];
  return (
    <section id="faq" className="py-14 sm:py-[90px]">
      <div className="mx-auto w-full max-w-[820px] px-5 sm:px-8">
        <h2 className="mb-2 text-[clamp(30px,4vw,44px)] font-extrabold tracking-tight text-primary">
          {dict.faqHeading}
        </h2>
        <p className="mb-9 text-lg text-muted">{dict.faqSub}</p>
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
