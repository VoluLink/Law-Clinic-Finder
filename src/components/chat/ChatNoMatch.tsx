import { Button, buttonClasses } from '@/components/ui/Button';
import type { Dictionary } from '@/lib/i18n/dictionary';

import { ChatRestartIcon, ChatTerminalCard } from './ChatTerminalCard';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SearchEmptyIcon = (
  <svg {...ICON_PROPS} width={18} height={18} strokeWidth={2} aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
    <path d="M8 11h6" />
  </svg>
);

/**
 * Shown when the assistant reports — via the `report_no_match` tool — that no
 * clinic fits. Its copy is app-owned: the concrete next steps, including the
 * Beratungshilfe hint, are ours to control and never the model's to invent.
 */
export function ChatNoMatch({
  dict,
  onRestart,
  restartDisabled,
}: {
  dict: Dictionary;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const steps = [dict.noMatchStep1, dict.noMatchStep2, dict.noMatchStep3];
  return (
    <ChatTerminalCard>
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-primary"
        >
          {SearchEmptyIcon}
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-primary">{dict.noMatchResultTitle}</h2>
          <p className="mt-0.5 text-sm font-bold text-primary">{dict.noMatchTitle}</p>
        </div>
      </div>
      <ol className="mt-3.5 flex flex-col gap-2.5">
        {steps.map((text, index) => (
          <li key={index} className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-[22px] shrink-0 items-center justify-center rounded-sm bg-chip text-[12px] font-extrabold text-primary"
            >
              {index + 1}
            </span>
            <p className="pt-px text-sm leading-relaxed text-foreground">{text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2.5 border-t border-border pt-3.5">
        <a
          href="https://law-clinics.de/"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('primary', 'default', 'px-4 py-2.5 text-sm font-bold')}
        >
          {dict.noMatchBtnDirectory}
        </a>
        <Button
          variant="accent"
          disabled={restartDisabled}
          onClick={onRestart}
          className="gap-2 px-4 py-2.5 text-sm font-bold"
        >
          <ChatRestartIcon />
          {dict.noMatchBtnRestart}
        </Button>
      </div>
    </ChatTerminalCard>
  );
}
