'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

export type PendingSubmission = {
  id: string;
  name: string;
  region: string | null;
  legal_areas: string;
  contact_email: string;
  submitted_at: string;
};

/** Amber approval queue above the clinic list — rendered only when non-empty. */
export function PendingSubmissions({ submissions }: { submissions: PendingSubmission[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function act(submission: PendingSubmission, method: 'POST' | 'DELETE', done: string) {
    setPendingId(submission.id);
    const response = await fetch(`/api/admin/submissions/${submission.id}`, { method }).catch(
      () => null,
    );
    setPendingId(null);
    setMessage(response?.ok ? done : 'Aktion fehlgeschlagen.');
    router.refresh();
  }

  function reject(submission: PendingSubmission) {
    if (!window.confirm(`Einreichung „${submission.name}" wirklich ablehnen?`)) return;
    void act(submission, 'DELETE', 'Einreichung abgelehnt.');
  }

  if (submissions.length === 0) return null;
  return (
    <section
      aria-label="Neue Einreichungen"
      className="flex flex-col gap-3 rounded-xl border border-accent-hover bg-accent/40 p-4"
    >
      <h2 className="font-semibold text-foreground">
        Neue Einreichungen zur Freischaltung ({submissions.length})
      </h2>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{submission.name}</p>
            <p className="truncate text-sm text-muted">
              {submission.region ?? 'Keine Region'} · {submission.legal_areas} ·{' '}
              {submission.contact_email} ·{' '}
              {new Date(submission.submitted_at).toLocaleDateString('de-DE')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={pendingId === submission.id}
              onClick={() =>
                void act(submission, 'POST', 'Freigeschaltet — Einladung wurde versendet.')
              }
            >
              Freischalten
            </Button>
            <Button
              variant="secondary"
              disabled={pendingId === submission.id}
              onClick={() => reject(submission)}
            >
              Ablehnen
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
