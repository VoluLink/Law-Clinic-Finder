'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ClinicAdmin } from '@/lib/clinics/schema';

import { EditClinicModal } from './EditClinicModal';
import { InviteClinicModal } from './InviteClinicModal';

export type AdminClinic = ClinicAdmin & { id: string };

async function requestJson(url: string, method: string, body?: object): Promise<boolean> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  return response?.ok ?? false;
}

export function ClinicsManager({ clinics }: { clinics: AdminClinic[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminClinic | null>(null);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: Promise<boolean>, successText: string) {
    setMessage((await action) ? successText : 'Aktion fehlgeschlagen.');
    router.refresh();
  }

  function togglePublish(clinic: AdminClinic) {
    void run(
      requestJson(`/api/admin/clinics/${clinic.id}`, 'PATCH', {
        is_published: !clinic.is_published,
      }),
      clinic.is_published ? 'Eintrag verborgen.' : 'Eintrag veröffentlicht.',
    );
  }

  function remove(clinic: AdminClinic) {
    if (!window.confirm(`„${clinic.name}" und den zugehörigen Login wirklich löschen?`)) return;
    void run(requestJson(`/api/admin/clinics/${clinic.id}`, 'DELETE'), 'Eintrag gelöscht.');
  }

  function reinvite(clinic: AdminClinic) {
    void run(
      requestJson(`/api/admin/clinics/${clinic.id}/invite`, 'POST'),
      'Einladung versendet (falls noch kein Login existiert).',
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Law Clinics</h1>
        <Button onClick={() => setInviting(true)}>Neue Law Clinic einladen</Button>
      </div>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {clinics.map((clinic) => (
          <Card key={clinic.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{clinic.name}</p>
              <p className="truncate text-sm text-muted">
                {clinic.region ?? 'Keine Region'} · {clinic.contact_email ?? 'Keine E-Mail'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={clinic.is_published ? 'primary' : 'neutral'}>
                {clinic.is_published ? 'Veröffentlicht' : 'Entwurf'}
              </Badge>
              <Button variant="secondary" onClick={() => setEditing(clinic)}>
                Bearbeiten
              </Button>
              <Button variant="secondary" onClick={() => togglePublish(clinic)}>
                {clinic.is_published ? 'Verbergen' : 'Veröffentlichen'}
              </Button>
              <Button variant="ghost" onClick={() => reinvite(clinic)}>
                Einladen
              </Button>
              <Button variant="danger" onClick={() => remove(clinic)}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <InviteClinicModal open={inviting} onClose={() => setInviting(false)} />
      <EditClinicModal clinic={editing} onClose={() => setEditing(null)} />
    </>
  );
}
