import { Button } from '@/components/ui/Button';
import type { Dictionary } from '@/lib/i18n/dictionary';

import { ChatRestartIcon, ChatSuccessIcon, ChatTerminalCard } from './ChatTerminalCard';

export function ChatCompleted({
  dict,
  onRestart,
  restartDisabled,
}: {
  dict: Dictionary;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  return (
    <ChatTerminalCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-success-surface text-success">
            <ChatSuccessIcon />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-primary">{dict.chatCompletedTitle}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-soft">
              {dict.chatCompletedDescription}
            </p>
          </div>
        </div>
        <Button
          disabled={restartDisabled}
          onClick={onRestart}
          className="gap-2 px-5 py-3 text-sm font-bold"
        >
          <ChatRestartIcon />
          {dict.chatCompletedBtnRestart}
        </Button>
      </div>
    </ChatTerminalCard>
  );
}
