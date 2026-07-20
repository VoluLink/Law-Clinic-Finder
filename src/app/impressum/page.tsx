import type { Metadata } from 'next';

import { LegalPage } from '@/components/layout/LegalPage';

export const metadata: Metadata = { title: 'Impressum – Law Clinic Finder' };

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <p className="text-muted">
        [Platzhalter – vor Veröffentlichung durch die Angaben des Betreibers ersetzen: Name und
        Anschrift der Organisation, Vertretungsberechtigte, Kontakt (E-Mail, Telefon),
        Registereintrag, Verantwortliche:r i.S.d. § 18 Abs. 2 MStV.]
      </p>
    </LegalPage>
  );
}
