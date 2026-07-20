import type { Metadata } from 'next';
import Link from 'next/link';

import { Footer } from '@/components/layout/Footer';
import { Wordmark } from '@/components/layout/Wordmark';
import { Card } from '@/components/ui/Card';
import { BackLink, StageHeading } from '@/components/ui/StageShell';
import { devLoginEnabled } from '@/lib/dev/dev-login';

import { DevLoginPanel } from './DevLoginPanel';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Anmelden – Law Clinic Finder' };

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-12">
        <Wordmark className="self-center" />
        <Card variant="panel" className="flex flex-col gap-5">
          <BackLink href="/" />
          <div className="flex flex-col gap-2">
            <StageHeading>Anmelden</StageHeading>
            <p className="text-base text-muted">
              Ein Zugang für Law Clinics und Administration. Ohne Passwort: Sie erhalten einen
              Anmeldelink an Ihre hinterlegte E-Mail-Adresse und landen automatisch in dem Bereich,
              der zu Ihrem Konto gehört.
            </p>
          </div>
          <LoginForm />
          {/* Server-side gate: the panel is never sent to the browser in production. */}
          {devLoginEnabled() && <DevLoginPanel />}
          <p className="border-t border-border pt-5 text-sm text-muted">
            Noch nicht dabei?{' '}
            <Link href="/signup" className="font-semibold text-primary underline">
              Law Clinic registrieren
            </Link>
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
