import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

type EditActionsProps = {
  dirty: boolean;
  busy?: boolean;
  onCancel: () => void;
  saveType?: 'submit' | 'button';
  onSave?: () => void;
  children?: ReactNode;
};

/** Shared Speichern/Abbrechen pair. Speichern greys out until `dirty`; both
 *  freeze while `busy`. Consumed by the member form and the admin table so the
 *  disabled-when-unchanged behaviour lives in one place. */
export function EditActions({
  dirty,
  busy = false,
  onCancel,
  saveType = 'button',
  onSave,
  children,
}: EditActionsProps) {
  return (
    <div className="flex items-center gap-4">
      <Button
        type={saveType === 'submit' ? 'submit' : 'button'}
        onClick={saveType === 'submit' ? undefined : onSave}
        disabled={busy || !dirty}
      >
        Speichern
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
        Abbrechen
      </Button>
      {children}
    </div>
  );
}
