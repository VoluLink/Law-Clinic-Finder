'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';

type SuggestInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  error?: string;
  labelHidden?: boolean;
  placeholder?: string;
};

/**
 * Single free-text field that surfaces standard values through a native
 * `<datalist>` — suggestions guide the entry, but any custom value is allowed.
 * Used for `region`, where the set of cities is effectively open-ended.
 */
export function SuggestInput({
  label,
  value,
  onChange,
  suggestions,
  error,
  labelHidden,
  placeholder,
}: SuggestInputProps) {
  const id = useId();
  const listId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cn('text-sm font-medium text-foreground', labelHidden && 'sr-only')}
      >
        {label}
      </label>
      <input
        id={id}
        list={listId}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
          error && 'border-danger',
        )}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
