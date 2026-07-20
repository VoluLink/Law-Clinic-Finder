'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LANG_COOKIE, LANGS, dirFor, type Lang } from '@/lib/i18n/config';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function persistLangCookie(code: Lang) {
  document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

type LanguageSwitcherProps = { current: Lang; label: string };

export function LanguageSwitcher({ current, label }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const short = LANGS.find((entry) => entry.code === current)?.short ?? 'DE';

  function selectLang(code: Lang) {
    persistLangCookie(code);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary/20 px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:border-primary"
      >
        <GlobeIcon />
        <span>{short}</span>
        <span aria-hidden className="text-[11px] opacity-60">
          ▾
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-50 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-[calc(100%+10px)] z-60 min-w-52 rounded-xl border border-border bg-surface p-2 shadow-[0_24px_50px_-24px_rgba(14,75,91,0.5)]">
            <div className="px-3 pt-2 pb-1.5 text-[11px] font-bold tracking-widest text-muted uppercase">
              {label}
            </div>
            {LANGS.map((entry) => (
              <button
                key={entry.code}
                type="button"
                dir={dirFor(entry.code)}
                onClick={() => selectLang(entry.code)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-start text-[15px] text-primary hover:bg-accent ${
                  entry.code === current ? 'bg-accent font-extrabold' : 'font-semibold'
                }`}
              >
                <span>{entry.native}</span>
                {entry.code === current && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </svg>
  );
}
