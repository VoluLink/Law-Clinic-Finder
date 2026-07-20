import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonShape = 'default' | 'pill';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:border-muted',
  ghost: 'text-foreground hover:bg-surface',
  danger: 'bg-danger text-danger-foreground hover:opacity-90',
  accent: 'bg-accent text-primary hover:bg-accent-hover',
};

const SHAPE_CLASSES: Record<ButtonShape, string> = {
  default: 'rounded-lg',
  pill: 'rounded-full',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ' +
  'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** For the rare element that must be an anchor but should look like a button.
 *  Shares this file's maps, so a restyle still lands in one place. */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  shape: ButtonShape = 'default',
  className?: string,
): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SHAPE_CLASSES[shape], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  shape?: ButtonShape;
};

export function Button({
  variant = 'primary',
  shape = 'default',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, shape, className)} {...props} />;
}
