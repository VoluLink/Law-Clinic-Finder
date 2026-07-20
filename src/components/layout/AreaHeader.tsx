import Link from 'next/link';

import { Button } from '@/components/ui/Button';

type AreaHeaderProps = { title: string };

/** Shared header for the gated areas (/clinic, /admin) with sign-out. */
export function AreaHeader({ title }: AreaHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-lg font-semibold text-foreground">
            Law Clinic Finder
          </Link>
          <span className="text-sm text-muted">{title}</span>
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost">
            Abmelden
          </Button>
        </form>
      </div>
    </header>
  );
}
