'use client';

import { cn } from '@/lib/cn';

type SuggestionListProps = {
  id: string;
  baseId: string;
  options: string[];
  active: number;
  onPick: (item: string) => void;
  /** When set, the matching option renders as an „…“ hinzufügen affordance. */
  custom?: string | null;
};

/**
 * The styled suggestion dropdown used by {@link TagCombobox}, kept as its own
 * component so every suggestion list in the app looks and behaves the same
 * (single source per DRY — change it here, it changes everywhere).
 */
export function SuggestionList({
  id,
  baseId,
  options,
  active,
  onPick,
  custom = null,
}: SuggestionListProps) {
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
