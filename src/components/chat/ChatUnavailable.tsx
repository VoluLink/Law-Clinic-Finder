import type { Dictionary } from '@/lib/i18n/dictionary';

const PausedChatIcon = (
  <svg
    viewBox="0 0 24 24"
    width={26}
    height={26}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 11.5a8.5 8.5 0 0 1-11.8 7.8L3 21l1.7-6.2A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M10 9v5" />
    <path d="M14 9v5" />
  </svg>
);

/**
 * Shown on the landing page in place of the chat box when the assistant is
 * switched off (admin kill-switch) or unconfigured. Same card chrome as the
 * search box so the hero keeps its shape; the copy is a calm "try again later",
 * not an alarming error.
 */
export function ChatUnavailable({ dict }: { dict: Dictionary }) {
  return (
    <section
      role="status"
      className="mx-auto flex max-w-[780px] flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center shadow-panel sm:p-10"
    >
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-accent text-primary"
      >
        {PausedChatIcon}
      </span>
      <h2 className="text-xl font-extrabold text-primary">{dict.chatUnavailableTitle}</h2>
      <p className="max-w-[440px] text-base leading-relaxed text-muted">{dict.chatDisabled}</p>
    </section>
  );
}
