import type { Metadata } from 'next';

import { Footer } from '@/components/layout/Footer';
import { Wordmark } from '@/components/layout/Wordmark';
import { Card } from '@/components/ui/Card';
import { StageHeading } from '@/components/ui/StageShell';

import { ConfirmLink } from './ConfirmLink';

export const metadata: Metadata = { title: 'Anmeldung bestätigen – Law Clinic Finder' };

export default function ConfirmPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-12">
        <Wordmark className="self-center" />
        <Card variant="panel" className="flex flex-col gap-5">
          <StageHeading>Anmeldung bestätigen</StageHeading>
          <ConfirmLink />
          <noscript>
            <p className="text-sm text-danger">
              Für die sichere Bestätigung muss JavaScript aktiviert sein. Fordere danach einen neuen
              Anmeldelink an.
            </p>
          </noscript>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
