import type { Metadata } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { LogsList, type LogRow } from './LogsList';

export const metadata: Metadata = { title: 'Protokolle – Admin' };

const MAX_ROWS = 200;

export default async function AdminLogsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('logs')
    .select('id, logged_at, level, msg, fields')
    .order('logged_at', { ascending: false })
    .limit(MAX_ROWS);
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Protokolle</h1>
      <p className="text-sm text-muted">
        Serverereignisse (Fehler, Warnungen, Hinweise) der letzten 7 Tage. Enthält keine
        personenbezogenen Daten — nur kurze Meldungen und technische Felder. „Für LLM kopieren“ legt
        die gefilterte Liste als NDJSON in die Zwischenablage, ideal zum Einfügen in einen
        Chat-Assistenten.
      </p>
      {/* Untyped supabase client cannot infer rows from the column string;
          the selected columns match LogRow exactly. */}
      <LogsList logs={(data ?? []) as unknown as LogRow[]} />
    </>
  );
}
