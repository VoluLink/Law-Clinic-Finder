import { cn } from '@/lib/cn';

type WordmarkVariant = 'dark' | 'light';
type WordmarkSize = 'md' | 'sm';

const VARIANT_CLASSES: Record<WordmarkVariant, { text: string; bar: string }> = {
  dark: { text: 'text-primary', bar: 'bg-primary' },
  light: { text: 'text-primary-foreground', bar: 'bg-primary-foreground' },
};

const SIZE_CLASSES: Record<WordmarkSize, { name: string; sub: string; bar: string }> = {
  md: { name: 'text-[22px]', sub: 'text-sm', bar: 'h-9 w-[7px]' },
  sm: { name: 'text-xl', sub: 'text-[13px]', bar: 'h-8 w-1.5' },
};

type WordmarkProps = { variant?: WordmarkVariant; size?: WordmarkSize; className?: string };

/** The "law clinics deutschland" logo: stacked type + a vertical bar (no image). */
export function Wordmark({ variant = 'dark', size = 'md', className }: WordmarkProps) {
  const colors = VARIANT_CLASSES[variant];
  const sizes = SIZE_CLASSES[size];
  return (
    <span className={cn('flex items-end gap-2', colors.text, className)}>
      <span className="flex flex-col gap-[3px] whitespace-nowrap">
        <span className={cn('leading-none font-extrabold tracking-tight', sizes.name)}>
          law clinics
        </span>
        <span className={cn('self-end leading-none font-semibold', sizes.sub)}>deutschland</span>
      </span>
      <span aria-hidden className={cn('block rounded-[1px]', sizes.bar, colors.bar)} />
    </span>
  );
}
