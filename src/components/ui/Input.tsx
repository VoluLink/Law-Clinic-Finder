import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type InputShape = 'default' | 'pill';

/* Start padding is applied separately below: `cn` concatenates rather than
   merging, so an icon offset and a shape offset must never both be emitted. */
const SHAPE_CLASSES: Record<InputShape, string> = {
  default: 'rounded-lg pe-3 py-2 text-sm',
  pill: 'rounded-full pe-5 py-3.5 text-base',
};

const START_PADDING: Record<InputShape, string> = { default: 'ps-3', pill: 'ps-5' };

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Hides the label visually but keeps it as the field's accessible name. */
  labelHidden?: boolean;
  leadingIcon?: ReactNode;
  shape?: InputShape;
};

export function Input({
  label,
  error,
  labelHidden,
  leadingIcon,
  shape = 'default',
  className,
  ...props
}: InputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cn('text-sm font-medium text-foreground', labelHidden && 'sr-only')}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {leadingIcon && (
          <span aria-hidden className="pointer-events-none absolute start-4 flex text-muted">
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full border border-border bg-background text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
            SHAPE_CLASSES[shape],
            leadingIcon ? 'ps-11' : START_PADDING[shape],
            error && 'border-danger',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
