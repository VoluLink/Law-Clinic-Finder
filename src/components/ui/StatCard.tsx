import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type StatTone = 'default' | 'dark';
export type HintTone = 'up' | 'muted';

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'border border-border bg-surface',
  dark: 'bg-primary text-primary-foreground',
};

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  hintTone?: HintTone;
  tone?: StatTone;
};

/** Dashboard metric tile. `dark` is the teal accent card (design: API-Kosten). */
export function StatCard({
  label,
  value,
  hint,
  hintTone = 'muted',
  tone = 'default',
}: StatCardProps) {
  const dark = tone === 'dark';
  return (
    <div className={cn('rounded-[16px] p-[22px]', TONE_CLASSES[tone])}>
      <div
        className={cn(
          'text-sm font-semibold',
          dark ? 'text-primary-foreground/70' : 'text-muted-soft',
        )}
      >
        {label}
      </div>
      <div
        className={cn('mt-1.5 text-[34px] font-extrabold tracking-tight', !dark && 'text-primary')}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            'mt-1 text-[13px]',
            dark
              ? 'text-primary-foreground/70'
              : hintTone === 'up'
                ? 'font-bold text-success-strong'
                : 'text-muted-soft',
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
