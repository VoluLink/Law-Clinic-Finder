import type { Metadata } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ConversationsList, type ConversationRow } from './ConversationsList';

export const metadata: Metadata = { title: 'Konversationen – Admin' };

const MAX_ROWS = 100;

export default async function AdminConversationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('conversations')
    .select(
      'id, created_at, redacted_transcript, redaction_status, detected_legal_area, ' +
        'detected_city, matched_clinic_count, message_count, model',
    )
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Konversationen</h1>
      <p className="text-sm text-muted">
        Verläufe werden vor der Speicherung automatisch anonymisiert (Namen, Adressen, E-Mails,
        Telefonnummern entfernt). Schlägt die Anonymisierung fehl, wird kein Verlauf gespeichert.
      </p>
      {/* Untyped supabase client cannot infer rows from the column string;
          the selected columns match ConversationRow exactly. */}
      <ConversationsList conversations={(data ?? []) as unknown as ConversationRow[]} />
    </>
  );
}
