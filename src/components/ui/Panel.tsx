import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

type PanelProps = {
  title?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** The admin section card (design: white, 16px radius, 24px padding, 800 title). */
export function Panel({ title, hint, action, className, children }: PanelProps) {
  return (
    <section className={cn('rounded-[16px] border border-border bg-surface p-6', className)}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-extrabold text-primary">{title}</h2>}
            {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
