'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import type { AdminAccount } from '@/lib/admin/manage-admins';

import { AccountForm } from '../account/AccountForm';

type AdminsManagerProps = {
  admins: AdminAccount[];
  currentEmail: string;
  currentUserId: string;
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Aktion fehlgeschlagen.';
}

export function AdminsManager({
  admins,
  currentEmail,
  currentUserId,
}: AdminsManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<AdminAccount | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus('');
    setError('');
    const response = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) return setError(response ? await readError(response) : 'Netzwerkfehler.');
    setEmail('');
    setStatus('Einladung gesendet.');
    router.refresh();
  }

  async function handleRemove(admin: AdminAccount) {
    setConfirming(null);
    setStatus('');
    setError('');
    const response = await fetch(`/api/admin/admins/${admin.userId}`, {
      method: 'DELETE',
    }).catch(() => null);
    if (!response?.ok) return setError(response ? await readError(response) : 'Netzwerkfehler.');
    setStatus('Admin-Konto entfernt.');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <AccountForm currentEmail={currentEmail} />

      <Panel
        title="Admin-Konten"
        hint="Alle Admins haben dieselben Rechte. Eine Einladung geht als Anmeldelink an die angegebene Adresse."
      >
        <ul className="flex flex-col gap-2">
          {admins.map((admin) => (
            <li
              key={admin.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{admin.email}</span>
                <Badge variant={admin.status === 'active' ? 'success' : 'warning'}>
                  {admin.status === 'active' ? 'aktiv' : 'eingeladen'}
                </Badge>
                {admin.userId === currentUserId && <Badge variant="neutral">du</Badge>}
              </span>
              <Button
                variant="secondary"
                disabled={admin.userId === currentUserId || admins.length <= 1}
                onClick={() => setConfirming(admin)}
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Weiteren Admin einladen">
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <Input
            label="E-Mail-Adresse"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={pending || email.trim().length === 0}>
              Einladung senden
            </Button>
            {status && (
              <p role="status" className="text-sm text-muted">
                {status}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </form>
      </Panel>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Admin-Konto entfernen"
      >
        <p className="text-sm text-muted">
          Der Zugang von {confirming?.email} wird gelöscht. Die Person kann sich danach nicht mehr
          anmelden.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Abbrechen
          </Button>
          <Button onClick={() => confirming && handleRemove(confirming)}>Entfernen</Button>
        </div>
      </Modal>
    </div>
  );
}
