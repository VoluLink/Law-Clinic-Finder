import { useId, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { FieldLabel } from './FieldLabel';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  labelHidden?: boolean;
  /** Explainer shown in an info-icon tooltip beside the label. */
  hint?: string;
  /** Marks the field as required (visual `*` only; no native DOM validation). */
  required?: boolean;
};

export function Textarea({
  label,
  error,
  labelHidden,
  hint,
  required,
  className,
  rows = 3,
  ...props
}: TextareaProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel
        htmlFor={id}
        label={label}
        hint={hint}
        required={required}
        labelHidden={labelHidden}
      />
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
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
