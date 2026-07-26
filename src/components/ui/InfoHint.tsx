'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from './Icon';
import type { IconName } from './Icon';

type InfoHintVariant = 'info' | 'warning';

type InfoHintProps = {
  text: string;
  /** Names the field this explains, for the trigger's accessible name. */
  label?: string;
  variant?: InfoHintVariant;
};

const HINT_ICONS: Record<InfoHintVariant, IconName> = {
  info: 'circle-info',
  warning: 'triangle-exclamation',
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_HALF_WIDTH = 128;
const VIEWPORT_GUTTER = 8;

function getTooltipPosition(trigger: HTMLButtonElement): TooltipPosition {
  const rect = trigger.getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  const minimum = TOOLTIP_HALF_WIDTH + VIEWPORT_GUTTER;
  const maximum = Math.max(minimum, window.innerWidth - minimum);
  return { left: Math.min(Math.max(center, minimum), maximum), top: rect.top - VIEWPORT_GUTTER };
}

function useTooltipPosition(open: boolean, triggerRef: RefObject<HTMLButtonElement | null>) {
  const [position, setPosition] = useState<TooltipPosition>();
  const updatePosition = useCallback(() => {
    if (triggerRef.current) setPosition(getTooltipPosition(triggerRef.current));
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return { position, updatePosition };
}

function TooltipOverlay({
  id,
  text,
  open,
  position,
}: {
  id: string;
  text: string;
  open: boolean;
  position?: TooltipPosition;
}) {
  return createPortal(
    <span
      id={id}
      role="tooltip"
      style={position}
      className={`pointer-events-none fixed z-[70] w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed font-normal normal-case tracking-normal text-foreground shadow-panel transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
    >
      {text}
    </span>,
    document.body,
  );
}

/**
 * Info icon that reveals an explainer on hover or keyboard focus. The visible
 * tooltip uses a portal, preventing table and panel overflow from clipping it.
 */
export function InfoHint({ text, label, variant = 'info' }: InfoHintProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const { position, updatePosition } = useTooltipPosition(open, triggerRef);

  useEffect(() => {
    // Keep the server and first client render identical; portals need the browser DOM.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true);
  }, []);

  function showTooltip() {
    updatePosition();
    setOpen(true);
  }

  return (
    <>
      <span className="inline-flex align-middle">
        <button
          ref={triggerRef}
          type="button"
          aria-label={label ? `Erklärung zu ${label}` : 'Erklärung'}
          aria-describedby={id}
          onBlur={() => setOpen(false)}
          onFocus={showTooltip}
          onMouseEnter={showTooltip}
          onMouseLeave={() => setOpen(false)}
          className="inline-flex text-muted-soft hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <Icon name={HINT_ICONS[variant]} className="h-4 w-4" />
        </button>
      </span>
      {portalReady && <TooltipOverlay id={id} text={text} open={open} position={position} />}
    </>
  );
}
