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
        Deine Chat-Nachrichten werden vor der Übermittlung mit lokalen, deterministischen Regeln um
        erkennbare Namen, Anschriften, E-Mail-Adressen, Telefonnummern und IBANs bereinigt. Erst der
        so bearbeitete Text wird zur Beantwortung an die Anthropic-API (Claude) übermittelt. Für die
        Redaktion selbst wird keine KI-API eingesetzt. Nach Ende des Gesprächs speichern wir nur den
        erneut lokal redigierten Verlauf. Automatische Erkennung kann Angaben außerhalb bekannter
        Muster übersehen; bitte nenne deshalb keine vollständigen Namen oder Kontaktdaten. Die
        redigierten Verläufe dienen der Verbesserung des Angebots und werden nicht an Dritte
        weitergegeben. Beratungsemail-Adressen aus dem Verzeichnis werden dem Modell nicht
        bereitgestellt; sie erscheinen nur auf einer vom Server geprüften Empfehlungskarte.
      </p>
      <h2 className="text-lg font-medium">Hosting und Datenbank</h2>
      <p>
        Unsere Daten liegen bei Supabase in der EU-Region Frankfurt am Main. Beim Aufruf der Website
        fallen technisch notwendige Zugriffsdaten an.
      </p>
      <h2 className="text-lg font-medium">Missbrauchsschutz des Chat-Assistenten</h2>
      <p>
        Um den kostenlosen Chat vor automatisierter oder übermäßiger Nutzung zu schützen, setzen wir
        beim ersten Chat des Tages ein technisch notwendiges, ausschließlich für den Chat-Endpunkt
        gültiges Cookie. Es enthält eine zufällige Kennung, ist für JavaScript nicht lesbar und
        verfällt um Mitternacht deutscher Zeit. In der Datenbank speichern wir nicht diese Kennung,
        sondern nur einen kryptografischen Hash, das Datum sowie höchstens zwei zufällige
        Gesprächskennungen und kleine Nachrichtenzähler. Die Daten werden nach dem Tageswechsel
        automatisch gelöscht, nicht für Werbung oder Reichweitenmessung verwendet und nicht mit
        einem Nutzerkonto verknüpft. Die Verarbeitung dient der Sicherheit, Verfügbarkeit und
        Kostenkontrolle des Angebots (Art. 6 Abs. 1 lit. f DSGVO).
      </p>
    </LegalPage>
  );
}
