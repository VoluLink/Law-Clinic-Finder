import type { ReactNode } from 'react';

export function ChatTerminalCard({ children }: { children: ReactNode }) {
  return (
    <section className="animate-[chat-in_0.3s_ease] rounded-xl border border-border bg-surface p-5 text-start">
      {children}
    </section>
  );
}

export function ChatRestartIcon() {
  return (
    <svg aria-hidden width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 1 0 3-6.7L3 8"
      />
      <path strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
    </svg>
  );
}

export function ChatSuccessIcon() {
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4.2 4.2L19 6.5"
      />
    </svg>
  );
}
