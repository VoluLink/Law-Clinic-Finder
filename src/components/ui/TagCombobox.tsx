'use client';

import { useId, useState, type KeyboardEvent } from 'react';

import { parseMultiValue, serializeMultiValue } from '@/lib/clinics/options';
import { cn } from '@/lib/cn';

type TagComboboxProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: readonly string[];
  error?: string;
  labelHidden?: boolean;
  placeholder?: string;
  /** When false, only listed suggestions can be added (default: custom allowed). */
  allowCustom?: boolean;
};

/**
 * Multi-value editor that stores a `"; "`-joined string but presents it as
 * removable chips plus a filtered suggestion list. Suggestions guide the entry;
 * a typed value that isn't listed can still be added, so novel and existing
 * messy values both stay expressible.
 */
export function TagCombobox({
  label,
  value,
  onChange,
  suggestions,
  error,
  labelHidden,
  placeholder,
  allowCustom = true,
}: TagComboboxProps) {
  const id = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selected = parseMultiValue(value);
  const selectedLower = new Set(selected.map((item) => item.toLowerCase()));
  const needle = query.trim().toLowerCase();
  const matches = suggestions.filter(
    (item) => !selectedLower.has(item.toLowerCase()) && item.toLowerCase().includes(needle),
  );
  const custom =
    allowCustom &&
    needle.length > 0 &&
    !selectedLower.has(needle) &&
    !suggestions.some((item) => item.toLowerCase() === needle)
      ? query.trim()
      : null;
  const options = custom ? [...matches, custom] : matches;

  function commit(item: string) {
    const next = item.trim();
    setQuery('');
    setActive(-1);
    if (!next || selectedLower.has(next.toLowerCase())) return;
    onChange(serializeMultiValue([...selected, next]));
  }

  function remove(item: string) {
    onChange(serializeMultiValue(selected.filter((entry) => entry !== item)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // options[0] is the top suggestion when one matches, otherwise the custom
      // row — so an un-arrowed Enter completes to a real option before a raw one.
      const pick = active >= 0 ? options[active] : options[0];
      if (pick) commit(pick);
    } else if (event.key === 'Backspace' && query === '' && selected.length > 0) {
      remove(selected[selected.length - 1]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div
      className="flex flex-col gap-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label
        htmlFor={id}
        className={cn('text-sm font-medium text-foreground', labelHidden && 'sr-only')}
      >
        {label}
      </label>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-2',
          'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary',
          error && 'border-danger',
        )}
      >
        <ChipList items={selected} onRemove={remove} />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          value={query}
          placeholder={selected.length === 0 ? placeholder : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none"
        />
      </div>
      {open && options.length > 0 && (
        <SuggestionList
          id={listId}
          baseId={id}
          options={options}
          custom={custom}
          active={active}
          onPick={commit}
        />
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-sm bg-chip px-2 py-0.5 text-[13px] font-semibold text-primary"
        >
          {item}
          <button
            type="button"
            aria-label={`${item} entfernen`}
            onClick={() => onRemove(item)}
            className="text-primary/60 hover:text-primary"
          >
            ×
          </button>
        </span>
      ))}
    </>
  );
}

type SuggestionListProps = {
  id: string;
  baseId: string;
  options: string[];
  custom: string | null;
  active: number;
  onPick: (item: string) => void;
};

function SuggestionList({ id, baseId, options, custom, active, onPick }: SuggestionListProps) {
  return (
    <ul
      id={id}
      role="listbox"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-panel"
    >
      {options.map((option, index) => (
        <li
          key={option}
          id={`${baseId}-opt-${index}`}
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(option)}
          className={cn(
            'cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-chip',
            index === active && 'bg-chip',
            option === custom && 'text-primary',
          )}
        >
          {option === custom ? `„${option}“ hinzufügen` : option}
        </li>
      ))}
    </ul>
  );
}
