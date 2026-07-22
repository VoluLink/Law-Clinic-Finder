import { cn } from '@/lib/cn';

export type MeterRow = { label: string; value: string; percent: number };

const FILL_CLASSES = ['bg-primary', 'bg-chart-3', 'bg-chart-2', 'bg-chart-1'] as const;

/** Ranked horizontal share bars (design: Zugriffsquellen / Nachgefragte Rechtsgebiete). */
export function MeterList({ rows }: { rows: MeterRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold text-foreground">{row.label}</span>
            <span className="font-bold text-primary">{row.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-chip">
            <div
              className={cn(
                'h-full rounded-full',
                FILL_CLASSES[Math.min(index, FILL_CLASSES.length - 1)],
              )}
              style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
