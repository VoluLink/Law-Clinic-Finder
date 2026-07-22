'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/layout/Wordmark';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

export type NavItem = { href: string; label: string; icon: IconName };
/** The pinned bottom identity block — doubles as the account/Konto tab link. */
export type PortalFooter = { href: string; title: string; subtitle: string; navLabel: string };

type PortalShellProps = {
  sectionLabel: string;
  nav: NavItem[];
  footer: PortalFooter;
  titles: Record<string, string>;
  /** The index route, matched exactly (siblings match by prefix). */
  homeHref: string;
  fallbackTitle: string;
  children: ReactNode;
};

function isActive(pathname: string, href: string, homeHref: string): boolean {
  return href === homeHref ? pathname === homeHref : pathname.startsWith(href);
}

function titleFor(
  pathname: string,
  titles: Record<string, string>,
  homeHref: string,
): string | null {
  const match = Object.keys(titles)
    .filter((href) => isActive(pathname, href, homeHref))
    .sort((a, b) => b.length - a.length)[0];
  return match ? titles[match] : null;
}

/** Teal sidebar + sticky title header shared by the admin and member portals.
 *  Route-per-tab; active state from usePathname. */
export function PortalShell({
  sectionLabel,
  nav,
  footer,
  titles,
  homeHref,
  fallbackTitle,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        pathname={pathname}
        sectionLabel={sectionLabel}
        nav={nav}
        footer={footer}
        homeHref={homeHref}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4 sm:px-8">
          <h1 className="text-[22px] font-extrabold tracking-tight text-primary">
            {titleFor(pathname, titles, homeHref) ?? fallbackTitle}
          </h1>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost">
              Abmelden
            </Button>
          </form>
        </header>
        <MobileNav pathname={pathname} nav={nav} footer={footer} homeHref={homeHref} />
        <main className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  pathname,
  sectionLabel,
  nav,
  footer,
  homeHref,
}: {
  pathname: string;
  sectionLabel: string;
  nav: NavItem[];
  footer: PortalFooter;
  homeHref: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col bg-primary px-[18px] py-[26px] text-primary-foreground min-[860px]:flex">
      <div className="px-2 pb-[26px]">
        <Wordmark variant="light" size="sm" />
      </div>
      <div className="px-3 pb-2.5 text-[11px] font-bold tracking-[0.14em] text-primary-foreground/[0.45] uppercase">
        {sectionLabel}
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href, homeHref)} />
        ))}
      </nav>
      <Link
        href={footer.href}
        aria-current={isActive(pathname, footer.href, homeHref) ? 'page' : undefined}
        className={cn(
          'mt-auto rounded-b border-t border-primary-foreground/[0.15] px-3 py-3.5 hover:bg-primary-foreground/[0.1]',
          isActive(pathname, footer.href, homeHref) && 'bg-primary-foreground/[0.1]',
        )}
      >
        <div className="truncate text-sm font-bold text-primary-foreground">{footer.title}</div>
        {footer.subtitle && (
          <div className="truncate text-[13px] text-primary-foreground/[0.6]">
            {footer.subtitle}
          </div>
        )}
      </Link>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-[11px] rounded-xl px-3.5 py-3 text-[15px] hover:bg-primary-foreground/[0.12]',
        active
          ? 'bg-primary-foreground/[0.12] font-bold'
          : 'font-medium text-primary-foreground/[0.85]',
      )}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

function MobileNav({
  pathname,
  nav,
  footer,
  homeHref,
}: {
  pathname: string;
  nav: NavItem[];
  footer: PortalFooter;
  homeHref: string;
}) {
  const items = [...nav, { href: footer.href, label: footer.navLabel }];
  return (
    <nav className="flex gap-2 overflow-x-auto bg-primary px-4 py-2 min-[860px]:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href, homeHref) ? 'page' : undefined}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-primary-foreground/[0.85]',
            isActive(pathname, item.href, homeHref) && 'bg-primary-foreground/[0.15] font-bold',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
