'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type Status = 'idle' | 'pending' | 'error';

/**
 * Danger zone for the member Account tab: opens a confirm dialog, deletes the
 * account, then signs out so the now-invalid session cookie is cleared before
 * landing on /login. The entry itself stays in the directory (server-side).
 */
export function AccountDeletePanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const signOutRef = useRef<HTMLFormElement>(null);

  async function confirmDelete() {
    setStatus('pending');
    const response = await fetch('/api/clinic/account', { method: 'DELETE' }).catch(() => null);
    if (response?.ok) {
      signOutRef.current?.requestSubmit();
      return;
    }
    setStatus('error');
    setOpen(false);
  }

  return (
    <section className="rounded-[16px] border border-danger/40 bg-danger/5 p-6">
      <h2 className="text-base font-extrabold text-danger">Konto löschen</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Dein Login wird entfernt und dein Eintrag aus dem Finder ausgeblendet. Deine Daten bleiben
        gespeichert – der Betreiber kann dich später erneut einladen.
      </p>
      {status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Löschen fehlgeschlagen. Bitte versuche es erneut.
        </p>
      )}
      <div className="mt-4">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Konto löschen
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => status !== 'pending' && setOpen(false)}
        title="Account wirklich löschen?"
      >
        <p className="text-sm text-muted">
          Dein Zugang wird gelöscht und deine Law Clinic erscheint nicht mehr im Finder. Rückgängig
          machen kann das nur der Betreiber.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={status === 'pending'}
          >
            Abbrechen
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={status === 'pending'}>
            {status === 'pending' ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </Button>
        </div>
      </Modal>

      <form ref={signOutRef} action="/auth/signout" method="post" className="hidden" />
    </section>
  );
}
