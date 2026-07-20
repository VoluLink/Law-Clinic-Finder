import Link from 'next/link';
import type { ReactNode } from 'react';

import { Footer } from './Footer';

type LegalPageProps = { title: string; children: ReactNode };

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12 text-foreground">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Zurück zur Startseite
        </Link>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex flex-col gap-4 text-sm leading-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
