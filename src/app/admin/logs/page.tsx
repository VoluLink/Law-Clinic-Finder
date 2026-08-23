import type { Metadata } from 'next';

import { firebaseLogRepository } from '@/lib/firebase/log-repository';

import { LogsList, type LogRow } from './LogsList';

export const metadata: Metadata = { title: 'Protokolle – Admin' };

const MAX_ROWS = 200;

export default async function AdminLogsPage() {
  const page = await firebaseLogRepository.listPage(MAX_ROWS);
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Protokolle</h1>
      <p className="text-sm text-muted">
        Warnungen und Fehler des Servers aus den letzten 7 Tagen. Routinemeldungen werden bewusst
        nicht hier gespeichert, sondern nur nach Google Cloud Logging geschrieben — eine leere Liste
        heißt also: alles in Ordnung. Enthält keine personenbezogenen Daten, nur kurze Meldungen und
        technische Felder. „Request anzeigen“ filtert auf alle Zeilen einer Anfrage; „Für LLM
        kopieren“ legt die gefilterte Liste als NDJSON in die Zwischenablage.
      </p>
      <LogsList logs={page.logs satisfies LogRow[]} unreadable={page.unreadable} />
    </>
  );
}
