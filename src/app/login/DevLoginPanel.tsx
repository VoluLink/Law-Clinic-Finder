import { buttonClasses } from '@/components/ui/Button';
import { DEV_ACCOUNTS } from '@/lib/dev/dev-login';

/**
 * Rendered only when `devLoginEnabled()` passes, so it cannot appear in a
 * production build. Plain links, not fetches: /api/dev/login redirects through
 * /auth/confirm, and a full navigation lets the session cookie land.
 */
export function DevLoginPanel() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-accent p-4">
      <p className="text-sm font-semibold text-primary">Nur für Tests</p>
      <p className="text-xs text-muted">
        Direkter Zugang ohne E-Mail-Bestätigung. Nur aktiv, solange{' '}
        <code className="font-mono">DEV_LOGIN_ENABLED=true</code> gesetzt ist.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="/api/dev/login?as=admin" className={buttonClasses('secondary')}>
          Als Admin anmelden
        </a>
        <a href="/api/dev/login?as=clinic" className={buttonClasses('secondary')}>
          Als Law Clinic anmelden
        </a>
      </div>
      <p className="text-xs text-muted">
        {DEV_ACCOUNTS.admin.email} · {DEV_ACCOUNTS.clinic.email}
      </p>
    </div>
  );
}
