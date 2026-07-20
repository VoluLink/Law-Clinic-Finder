import type { Metadata } from 'next';

import { LegalPage } from '@/components/layout/LegalPage';

export const metadata: Metadata = { title: 'Datenschutz – Law Clinic Finder' };

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p className="text-muted">
        [Platzhalter – vor Veröffentlichung juristisch prüfen lassen und vervollständigen:
        Verantwortlicher, Rechtsgrundlagen, Betroffenenrechte, Speicherdauern, Hosting.]
      </p>
      <h2 className="text-lg font-medium">Chat-Assistent</h2>
      <p>
        Ihre Chat-Nachrichten werden zur Beantwortung an die Anthropic-API (Claude) übermittelt.
        Nach Ende des Gesprächs speichern wir den Verlauf ausschließlich in anonymisierter Form:
        Namen, Adressen, E-Mail-Adressen und Telefonnummern werden vor der Speicherung automatisiert
        entfernt. Die anonymisierten Verläufe dienen der Verbesserung des Angebots und werden nicht
        an Dritte weitergegeben. Bitte nennen Sie im Chat keine vollständigen Namen oder
        Kontaktdaten.
      </p>
      <h2 className="text-lg font-medium">Hosting und Datenbank</h2>
      <p>
        Unsere Daten liegen bei Supabase in der EU-Region Frankfurt am Main. Beim Aufruf der Website
        fallen technisch notwendige Zugriffsdaten an.
      </p>
    </LegalPage>
  );
}
