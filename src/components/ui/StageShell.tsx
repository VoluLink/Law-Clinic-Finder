import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared card chrome for the signup stages and the login page — one
 *  definition so the two flows cannot drift apart. */
const BACK_CLASSES = 'self-start text-sm font-semibold text-primary hover:underline';

export function BackLink({ href, onClick }: { href?: string; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} className={BACK_CLASSES}>
        ← Zurück
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={BACK_CLASSES}>
      ← Zurück
    </button>
  );
}

export function StageHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] leading-tight font-extrabold text-primary">{children}</h1>;
}
