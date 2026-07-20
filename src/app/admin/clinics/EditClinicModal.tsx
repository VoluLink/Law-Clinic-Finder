'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ClinicFields } from '@/components/clinics/ClinicFields';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { clinicAdminSchema, type ClinicAdmin } from '@/lib/clinics/schema';

type AdminClinicRow = ClinicAdmin & { id: string };

type EditClinicModalProps = {
  clinic: AdminClinicRow | null;
  onClose: () => void;
};

export function EditClinicModal({ clinic, onClose }: EditClinicModalProps) {
  return (
    <Modal open={clinic !== null} onClose={onClose} title="Law Clinic bearbeiten">
      {/* key remounts the form per clinic, resetting its local state */}
      {clinic && <EditClinicForm key={clinic.id} clinic={clinic} onClose={onClose} />}
    </Modal>
  );
}

function EditClinicForm({ clinic, onClose }: { clinic: AdminClinicRow; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState<ClinicAdmin>(() => clinicAdminSchema.parse(clinic));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicAdminSchema.safeParse(value);
    if (!parsed.success) {
      setError('Bitte prüfen Sie die Eingaben.');
      return;
    }
    setPending(true);
    const response = await fetch(`/api/admin/clinics/${clinic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError('Speichern fehlgeschlagen.');
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <ClinicFields value={value} onChange={(next) => setValue({ ...value, ...next })} />
      <Checkbox
        label="Veröffentlicht (im Chat und Verzeichnis sichtbar)"
        checked={value.is_published}
        onChange={(e) => setValue({ ...value, is_published: e.target.checked })}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={pending}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
