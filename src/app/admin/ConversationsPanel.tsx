'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChatText } from '@/components/chat/ChatText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { ChatMessage } from '@/lib/chat/schema';

export type ConversationRecommendation = {
  id: string;
  name: string;
  region: string | null;
  legalAreas: string[];
  website: string | null;
};

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
  recommendations: ConversationRecommendation[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function previewOf(row: ConversationRow): string {
  const first = row.redacted_transcript?.find((message) => message.role === 'user');
  if (first) return first.content;
  return row.redaction_status === 'failed' ? 'Nur Statistik gespeichert.' : 'Kein Verlauf.';
}

export function ConversationsPanel({ conversations }: { conversations: ConversationRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ConversationRow | null>(null);

  async function remove(row: ConversationRow) {
    if (!window.confirm('Diese Konversation endgültig löschen?')) return;
    await fetch(`/api/admin/conversations/${row.id}`, { method: 'DELETE' }).catch(() => null);
    setSelected(null);
    router.refresh();
  }

  if (conversations.length === 0) {
    return <p className="text-sm text-muted">Noch keine Gespräche gespeichert.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {conversations.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelected(row)}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-start hover:border-muted"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">{row.detected_legal_area ?? 'Unbekannt'}</Badge>
                {row.detected_city && (
                  <span className="text-sm text-muted">{row.detected_city}</span>
                )}
              </span>
              <span className="mt-1 block truncate text-sm text-muted">{previewOf(row)}</span>
            </span>
            <Icon name="arrow-right" className="h-3.5 w-3.5 shrink-0 text-muted" />
          </button>
        ))}
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Gesprächsverlauf"
        subtitle={
          selected
            ? `${formatDate(selected.created_at)} · ${selected.message_count} Nachrichten`
            : undefined
        }
      >
        {selected && <ConversationDetail row={selected} onDelete={() => remove(selected)} />}
      </Drawer>
    </>
  );
}

function ConversationDetail({ row, onDelete }: { row: ConversationRow; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="neutral">Rechtsgebiet: {row.detected_legal_area ?? 'Unbekannt'}</Badge>
        <Badge variant="neutral">Treffer: {row.matched_clinic_count ?? 0}</Badge>
      </div>
      <div className="flex flex-col gap-3">
        {(row.redacted_transcript ?? []).map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        {!row.redacted_transcript && (
          <p className="text-sm text-muted">Für dieses Gespräch wurde kein Verlauf gespeichert.</p>
        )}
      </div>
      <RecommendationList items={row.recommendations} />
      <p className="text-xs text-muted-soft">
        Pseudonymisiert – personenbezogene Angaben werden automatisch entfernt.
      </p>
      <Button variant="danger" onClick={onDelete} className="self-start">
        Löschen
      </Button>
    </div>
  );
}

function RecommendationList({ items }: { items: ConversationRecommendation[] }) {
  if (items.length === 0) return null;
  return (
    <section className="border-t border-border pt-4" aria-labelledby="conversation-recommendations">
      <h3 id="conversation-recommendations" className="mb-3 text-sm font-bold text-foreground">
        Empfohlene Law Clinics
      </h3>
      <ol aria-label="Empfohlene Law Clinics" className="flex flex-col gap-3">
        {items.map((clinic, index) => (
          <RecommendationCard key={clinic.id} clinic={clinic} rank={index + 1} />
        ))}
      </ol>
    </section>
  );
}

function RecommendationCard({
  clinic,
  rank,
}: {
  clinic: ConversationRecommendation;
  rank: number;
}) {
  return (
    <li>
      <Card className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground"
        >
          {rank}
        </span>
        <RecommendationSummary clinic={clinic} />
      </Card>
    </li>
  );
}

function RecommendationSummary({ clinic }: { clinic: ConversationRecommendation }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="font-extrabold text-primary">{clinic.name}</h4>
        {clinic.region && <span className="text-sm text-muted-soft">{clinic.region}</span>}
      </div>
      <RecommendationAreas areas={clinic.legalAreas} />
      <RecommendationWebsite website={clinic.website} />
    </div>
  );
}

function RecommendationAreas({ areas }: { areas: string[] }) {
  if (areas.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {areas.map((area) => (
        <Badge key={area} variant="neutral">
          {area}
        </Badge>
      ))}
    </div>
  );
}

function RecommendationWebsite({ website }: { website: string | null }) {
  if (!website) return null;
  return (
    <a
      href={website}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex text-sm font-bold text-primary hover:text-primary-hover"
    >
      Zur Website <Icon name="arrow-right" className="ms-1 mt-0.5 h-3.5 w-3.5" />
    </a>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <span className="px-1 text-xs font-bold tracking-wide text-muted-soft">
        {isUser ? 'Ratsuchende Person' : 'KI-Assistent'}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-[16px] px-4 py-2.5 text-sm whitespace-pre-wrap',
          isUser
            ? 'rounded-ee-[4px] bg-primary text-primary-foreground'
            : 'rounded-es-[4px] border border-border bg-surface text-foreground',
        )}
      >
        {isUser ? message.content : <ChatText>{message.content}</ChatText>}
      </div>
    </div>
  );
}
