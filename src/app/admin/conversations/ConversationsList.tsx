'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import type { ChatMessage } from '@/lib/chat/schema';

export type ConversationRow = {
  id: string;
  created_at: string;
  redacted_transcript: ChatMessage[] | null;
  redaction_status: 'ok' | 'failed';
  detected_legal_area: string | null;
  detected_city: string | null;
  matched_clinic_count: number | null;
  message_count: number;
  model: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ConversationsList({ conversations }: { conversations: ConversationRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ConversationRow | null>(null);

  async function remove(row: ConversationRow) {
    if (!window.confirm('Diese Konversation endgültig löschen?')) return;
    await fetch(`/api/admin/conversations/${row.id}`, { method: 'DELETE' }).catch(() => null);
    setSelected(null);
    router.refresh();
  }

  if (conversations.length === 0) {
    return <p className="text-sm text-muted">Noch keine Konversationen gespeichert.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {conversations.map((row) => (
          <Card key={row.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.detected_legal_area ?? 'Rechtsgebiet unbekannt'}
                {row.detected_city ? ` · ${row.detected_city}` : ''}
              </p>
              <p className="text-sm text-muted">
                {formatDate(row.created_at)} · {row.message_count} Nachrichten ·{' '}
                {row.matched_clinic_count ?? 0} Treffer
              </p>
            </div>
            <div className="flex items-center gap-2">
              {row.redaction_status === 'failed' && <Badge>Nur Statistik</Badge>}
              <Button
                variant="secondary"
                onClick={() => setSelected(row)}
                disabled={!row.redacted_transcript}
              >
                Ansehen
              </Button>
              <Button variant="danger" onClick={() => remove(row)}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Anonymisierter Verlauf"
      >
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {(selected?.redacted_transcript ?? []).map((message, index) => (
            <div key={index} className="text-sm">
              <span className="font-medium text-foreground">
                {message.role === 'user' ? 'Besucher:in: ' : 'Assistent: '}
              </span>
              <span className="whitespace-pre-wrap text-muted">{message.content}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
