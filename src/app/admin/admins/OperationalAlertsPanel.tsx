'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import type { AdminAccount } from '@/lib/admin/manage-admins';
import type { OperationalAlertRecipient } from '@/lib/admin/operational-alerts';

type OperationalAlertsPanelProps = {
  admins: AdminAccount[];
  recipient: OperationalAlertRecipient | null;
};

export function OperationalAlertsPanel({ admins, recipient }: OperationalAlertsPanelProps) {
  const form = useRecipientForm(recipient);
  const activeAdmins = admins.filter((admin) => admin.status === 'active');
  return (
    <Panel
      title="Admin-Benachrichtigungen"
      hint="Der gewählte aktive Admin erhält alle E-Mails an die Administration: technische Google-Cloud-Ausfall- und Kapazitätswarnungen ebenso wie fachliche Hinweise, etwa einen neuen Eintrag, der auf die Freigabe wartet. Ohne ausdrückliche Auswahl gilt automatisch der am längsten bestehende aktive Admin."
    >
      <form onSubmit={form.handleSave} className="flex flex-col gap-4">
        <RecipientOptions
          admins={activeAdmins}
          recipient={recipient}
          selectedUserId={form.selectedUserId}
          onSelect={form.setSelectedUserId}
        />
        <FormFeedback {...form} />
        <p className="text-xs text-muted">
          Firestore speichert nur die Admin-Konto-ID. Die aktuelle Zieladresse wird bei jeder
          Änderung sicher aus Firebase Authentication gelesen.
        </p>
      </form>
    </Panel>
  );
}

function useRecipientForm(recipient: OperationalAlertRecipient | null) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(recipient?.userId ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus('');
    setError('');
    const response = await saveRecipient(selectedUserId);
    setPending(false);
    if (!response) return setError('Speichern fehlgeschlagen. Bitte versuche es erneut.');
    setStatus(
      'Empfänger gespeichert. Alle Admin-E-Mails gehen an diese Adresse; die Cloud-Konfiguration wird aktualisiert.',
    );
    router.refresh();
  }
  return { selectedUserId, setSelectedUserId, status, error, pending, handleSave };
}

type RecipientOptionsProps = {
  admins: AdminAccount[];
  recipient: OperationalAlertRecipient | null;
  selectedUserId: string;
  onSelect: (userId: string) => void;
};

function RecipientOptions(props: RecipientOptionsProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-foreground">Empfänger</legend>
      {props.admins.map((admin) => (
        <RecipientOption key={admin.userId} admin={admin} {...props} />
      ))}
    </fieldset>
  );
}

function RecipientOption(props: RecipientOptionsProps & { admin: AdminAccount }) {
  const { admin, recipient, selectedUserId, onSelect } = props;
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border p-3">
      <input
        type="radio"
        name="operational-alert-recipient"
        value={admin.userId}
        checked={selectedUserId === admin.userId}
        onChange={() => onSelect(admin.userId)}
      />
      <span className="text-sm font-semibold text-foreground">{admin.email}</span>
      {recipient?.source === 'default' && recipient.userId === admin.userId && (
        <Badge variant="neutral">Standard</Badge>
      )}
    </label>
  );
}

type FormFeedbackProps = ReturnType<typeof useRecipientForm>;

function FormFeedback({ selectedUserId, pending, status, error }: FormFeedbackProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit" disabled={pending || selectedUserId.length === 0}>
        Empfänger speichern
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
  );
}

async function saveRecipient(userId: string): Promise<boolean> {
  const response = await fetch('/api/admin/operational-alerts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }).catch(() => null);
  return Boolean(response?.ok);
}
