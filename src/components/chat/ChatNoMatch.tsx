import { Button } from '@/components/ui/Button';
import type { Dictionary } from '@/lib/i18n/dictionary';

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

const RestartIcon = (
  <svg {...ICON_PROPS} width={15} height={15} strokeWidth={2.2} aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

/**
 * Shown when the assistant reports — via the `report_no_match` tool — that no
 * clinic fits. Its copy is app-owned: the concrete next steps, including the
 * Beratungshilfe hint, are ours to control and never the model's to invent.
 */
export function ChatNoMatch({ dict, onRestart }: { dict: Dictionary; onRestart: () => void }) {
  const steps = [dict.noMatchStep1, dict.noMatchStep2, dict.noMatchStep3];
  return (
    <div className="animate-[chat-in_0.3s_ease] rounded-xl border border-border bg-surface p-5 text-start">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-primary"
        >
          {SearchEmptyIcon}
        </span>
        <h3 className="text-[15px] font-extrabold text-primary">{dict.noMatchTitle}</h3>
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
        <Button
          variant="accent"
          onClick={onRestart}
          className="gap-2 px-4 py-2.5 text-sm font-bold"
        >
          {RestartIcon}
          {dict.noMatchBtnRestart}
        </Button>
      </div>
    </div>
  );
}
