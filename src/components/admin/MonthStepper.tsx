import Link from 'next/link';

import { buttonClasses } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { canGoNext, canGoPrev, formatMonthLabel, stepMonth } from '@/lib/admin/month-window';
import { cn } from '@/lib/cn';

type MonthStepperProps = { month: string; now: number };

/**
 * Prev/next month control for the admin dashboard, in the site design language.
 * Rendered as `?month=…` links so the page stays a server component; the arrow at
 * a boundary (oldest retained month / current month) is a disabled span, not a link.
 * `now` is passed in (request-time) rather than read here, keeping render pure.
 */
export function MonthStepper({ month, now }: MonthStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <StepArrow
        target={stepMonth(month, -1)}
        enabled={canGoPrev(month, now)}
        icon="arrow-left"
        label="Vorheriger Monat"
      />
      <span className="min-w-[9.5rem] text-center text-sm font-semibold text-foreground">
        {formatMonthLabel(month)}
      </span>
      <StepArrow
        target={stepMonth(month, 1)}
        enabled={canGoNext(month, now)}
        icon="arrow-right"
        label="Nächster Monat"
      />
    </div>
  );
}

type StepArrowProps = { target: string; enabled: boolean; icon: IconName; label: string };

function StepArrow({ target, enabled, icon, label }: StepArrowProps) {
  const className = cn(buttonClasses('secondary'), 'px-3');
  if (!enabled) {
    return (
      <span aria-hidden="true" className={cn(className, 'pointer-events-none opacity-40')}>
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <Link href={`?month=${target}`} aria-label={label} className={className}>
      <Icon name={icon} className="h-3.5 w-3.5" />
    </Link>
  );
}
