import { cn } from '@/lib/cn';

/** The "Law Clinic Finder" kicker — hero intro and the chat panel header. */
export function BrandLine({ className }: { className?: string }) {
  return (
    <div className={cn('text-sm font-bold tracking-[0.16em] text-primary/80 uppercase', className)}>
      Law Clinic Finder
    </div>
  );
}
