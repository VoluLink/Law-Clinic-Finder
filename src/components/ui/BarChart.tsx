import { cn } from '@/lib/cn';

export type Bar = { label: string; value: number };

/** Later (more recent) bars are darker, ending at the primary petrol. */
function barColor(index: number, count: number): string {
  const fraction = count <= 1 ? 1 : index / (count - 1);
  if (fraction >= 0.85) return 'bg-primary';
  if (fraction >= 0.6) return 'bg-chart-3';
  if (fraction >= 0.3) return 'bg-chart-2';
  return 'bg-chart-1';
}

/** Vertical bar chart of equal-width columns; heights are relative to the max. */
export function BarChart({ bars, className }: { bars: Bar[]; className?: string }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className={cn('flex h-[180px] items-end gap-[14px]', className)}>
      {bars.map((bar, index) => (
        <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-bold text-primary">{bar.value}</span>
          <div className="flex min-h-0 w-full flex-1 items-end">
            <div
              className={cn(
                'w-full origin-bottom rounded-t-md animate-[bar-grow_0.6s_ease]',
                barColor(index, bars.length),
              )}
              style={{ height: `${(bar.value / max) * 100}%` }}
              role="img"
              aria-label={`${bar.label}: ${bar.value}`}
            />
          </div>
          <span className="text-xs text-muted-soft">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
