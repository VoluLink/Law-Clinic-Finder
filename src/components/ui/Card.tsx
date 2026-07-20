import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'panel';

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'rounded-xl p-4 shadow-sm',
  panel: 'rounded-3xl p-6 shadow-panel sm:p-9',
};

type CardProps = HTMLAttributes<HTMLDivElement> & { variant?: CardVariant };

export function Card({ variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn('border border-border bg-surface', VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
