import { useId, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

/**
 * A switch — the same native checkbox semantics as `Checkbox`, styled as a
 * sliding track+thumb. Drop-in with an `onChange` that reads `e.target.checked`.
 * The visual is driven by `peer-checked` utilities over design tokens, so a
 * restyle stays in this one file.
 */
export function Toggle({ label, className, ...props }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <label htmlFor={id} className="relative inline-flex cursor-pointer items-center">
        <input id={id} type="checkbox" className="peer sr-only" {...props} />
        <span className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50" />
        <span className="absolute start-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </label>
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {label}
      </label>
    </div>
  );
}
