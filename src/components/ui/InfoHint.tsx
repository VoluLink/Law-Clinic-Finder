import { useId } from 'react';

import { Icon } from './Icon';

type InfoHintProps = {
  text: string;
  /** Names the field this explains, for the trigger's accessible name. */
  label?: string;
};

/**
 * Info icon that reveals an explainer on hover or keyboard focus, shown next to
 * clinic fields across the admin, member and signup surfaces. The reveal is pure
 * CSS (group-hover / group-focus-within); the trigger is a focusable button
 * described by the text, so keyboard and screen-reader users get it too.
 */
export function InfoHint({ text, label }: InfoHintProps) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ? `Erklärung zu ${label}` : 'Erklärung'}
        aria-describedby={id}
        className="inline-flex text-muted-soft hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <Icon name="circle-info" className="h-4 w-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed font-normal normal-case tracking-normal text-foreground opacity-0 shadow-panel transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
