import { useId, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type SelectOption = { value: string; label: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  labelHidden?: boolean;
  options: SelectOption[];
};

/** Labelled wrapper over a native `<select>` — the one dropdown primitive. */
export function Select({ label, labelHidden, options, className, ...props }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cn('text-sm font-medium text-foreground', labelHidden && 'sr-only')}
      >
        {label}
      </label>
      <select
        id={id}
        className={cn(
          'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
