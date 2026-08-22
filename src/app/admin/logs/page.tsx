import type { Metadata } from 'next';

import { firebaseLogRepository } from '@/lib/firebase/log-repository';

import { LogsList, type LogRow } from './LogsList';

export const metadata: Metadata = { title: 'Protokolle – Admin' };

const MAX_ROWS = 200;

export default async function AdminLogsPage() {
  const logs = await firebaseLogRepository.list(MAX_ROWS);
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Protokolle</h1>
      <p className="text-sm text-muted">
        Serverereignisse (Fehler, Warnungen, Hinweise) der letzten 7 Tage. Enthält keine
        personenbezogenen Daten — nur kurze Meldungen und technische Felder. „Für LLM kopieren“ legt
        die gefilterte Liste als NDJSON in die Zwischenablage, ideal zum Einfügen in einen
        Chat-Assistenten.
      </p>
      <LogsList logs={logs satisfies LogRow[]} />
    </>
  );
}
