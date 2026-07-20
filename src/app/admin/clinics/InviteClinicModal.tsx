'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { clinicInviteSchema } from '@/lib/clinics/schema';

type InviteClinicModalProps = { open: boolean; onClose: () => void };

export function InviteClinicModal({ open, onClose }: InviteClinicModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicInviteSchema.safeParse({ name, contact_email: email });
    if (!parsed.success) {
      setError('Bitte Name und gültige E-Mail-Adresse angeben.');
      return;
    }
    setPending(true);
    const response = await fetch('/api/admin/clinics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError('Einladen fehlgeschlagen.');
      return;
    }
    setName('');
    setEmail('');
    setError(null);
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Neue Law Clinic einladen">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name der Law Clinic" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="E-Mail-Adresse der Organisation (für den Login)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={pending}>
            Einladung senden
          </Button>
        </div>
      </form>
    </Modal>
  );
}
