import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from './Icon';

/** Shared card chrome for the signup stages and the login page — one
 *  definition so the two flows cannot drift apart. */
const BACK_CLASSES =
  'inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline';

export function BackLink({ href, onClick }: { href?: string; onClick?: () => void }) {
  const content = (
    <>
      <Icon name="arrow-left" className="h-3 w-3" />
      Zurück
    </>
  );
  if (href) {
    return (
      <Link href={href} className={BACK_CLASSES}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={BACK_CLASSES}>
      {content}
    </button>
  );
}

export function StageHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] leading-tight font-extrabold text-primary">{children}</h1>;
}
