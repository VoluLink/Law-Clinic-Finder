import { useId, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function Textarea({ label, error, className, rows = 3, ...props }: TextareaProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
