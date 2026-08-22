'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import {
  smtpSettingsUpdateSchema,
  type SmtpSettingsView,
  type SmtpTlsMode,
} from '@/lib/mail/smtp-settings';

type FormValues = {
  host: string;
  port: string;
  tlsMode: SmtpTlsMode;
  loginEmail: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

const TLS_OPTIONS = [
  { value: 'starttls', label: 'STARTTLS (Port 587)' },
  { value: 'implicit', label: 'Implizites TLS (Port 465)' },
];

const SOURCE_LABELS: Record<SmtpSettingsView['source'], string> = {
  secret: 'Aktive Konfiguration aus Secret Manager',
  environment: 'Noch keine Version aktiviert — es gilt die Deployment-Umgebung',
  none: 'Kein Versand konfiguriert',
};

function initialValues(view: SmtpSettingsView): FormValues {
  const values = view.values;
  return {
    host: values?.host ?? '',
    port: values ? String(values.port) : '587',
    tlsMode: values?.tlsMode ?? 'starttls',
    loginEmail: values?.loginEmail ?? '',
    password: '',
    fromEmail: values?.fromEmail ?? '',
    fromName: values?.fromName ?? '',
  };
}

/** The password is write-only, so an unchanged field must send nothing at all. */
function payloadFrom(values: FormValues) {
  return smtpSettingsUpdateSchema.safeParse({
    host: values.host,
    port: Number(values.port),
    tlsMode: values.tlsMode,
    loginEmail: values.loginEmail,
    fromEmail: values.fromEmail,
    fromName: values.fromName,
    ...(values.password ? { password: values.password } : {}),
  });
}

export function SmtpForm({ view }: { view: SmtpSettingsView }) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(view));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const idempotency = useRef<{ payload: string; key: string } | null>(null);

  const set = <K extends keyof FormValues>(key: K, next: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: next }));

  /** A retry of the same payload must replay, not activate a second version. */
  function keyFor(payload: string): string {
    if (idempotency.current?.payload !== payload) {
      idempotency.current = { payload, key: crypto.randomUUID() };
    }
    return idempotency.current.key;
  }

  async function submit(url: string, body?: string) {
    setPending(true);
    setMessage(null);
    const response = await fetch(url, {
      method: body ? 'PUT' : 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': keyFor(body ?? `rollback:${view.updatedAt ?? ''}`),
      },
      ...(body ? { body } : {}),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => null) : null;
    setPending(false);
    if (response?.ok) {
      idempotency.current = null;
      setValues((current) => ({ ...current, password: '' }));
      setMessage({ tone: 'ok', text: 'Geprüft und aktiviert.' });
      router.refresh();
      return;
    }
    setMessage({ tone: 'error', text: result?.error ?? 'Speichern fehlgeschlagen.' });
  }

  async function save() {
    const parsed = payloadFrom(values);
    if (!parsed.success) {
      setMessage({ tone: 'error', text: 'Bitte Host, Port, Adressen und Absender prüfen.' });
      return;
    }
    await submit('/api/admin/smtp', JSON.stringify(parsed.data));
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusPanel view={view} />
      <Panel
        title="Serververbindung"
        hint="Provider-neutral. Die Einstellungen werden vor dem Aktivieren gegen den Server geprüft."
      >
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <Input
            label="Host"
            value={values.host}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('host', event.target.value)}
          />
          <Input
            label="Port"
            inputMode="numeric"
            value={values.port}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('port', event.target.value)}
          />
          <Select
            label="TLS-Modus"
            value={values.tlsMode}
            disabled={!view.provisioned || pending}
            options={TLS_OPTIONS}
            onChange={(event) => set('tlsMode', event.target.value as SmtpTlsMode)}
          />
          <Input
            label="Login"
            type="email"
            autoComplete="off"
            value={values.loginEmail}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('loginEmail', event.target.value)}
          />
          <Input
            label="Passwort / API-Key"
            type="password"
            autoComplete="new-password"
            placeholder={
              view.passwordSet ? 'gesetzt — leer lassen, um es zu behalten' : 'nicht gesetzt'
            }
            value={values.password}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('password', event.target.value)}
            hint="Wird nie angezeigt und nur als vollständige neue Secret-Version gespeichert."
          />
        </div>
      </Panel>
      <Panel title="Absender" hint="Adresse und Name, die Empfänger in Auth-Mails sehen.">
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <Input
            label="Absenderadresse"
            type="email"
            value={values.fromEmail}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('fromEmail', event.target.value)}
          />
          <Input
            label="Absendername"
            value={values.fromName}
            disabled={!view.provisioned || pending}
            onChange={(event) => set('fromName', event.target.value)}
          />
        </div>
      </Panel>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={save} disabled={!view.provisioned || pending}>
          Prüfen &amp; aktivieren
        </Button>
        <Button
          variant="secondary"
          onClick={() => submit('/api/admin/smtp/rollback')}
          disabled={!view.rollbackAvailable || pending}
        >
          Auf letzte geprüfte Version zurücksetzen
        </Button>
        {message && (
          <span
            role="status"
            className={message.tone === 'ok' ? 'text-sm text-muted' : 'text-sm text-danger'}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusPanel({ view }: { view: SmtpSettingsView }) {
  return (
    <Panel title="Status">
      <div className="flex flex-col gap-2 text-sm text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={view.source === 'secret' ? 'success' : 'warning'}>
            {SOURCE_LABELS[view.source]}
          </Badge>
          <Badge variant={view.passwordSet ? 'neutral' : 'danger'}>
            {view.passwordSet ? 'Passwort gesetzt' : 'Passwort nicht gesetzt'}
          </Badge>
        </div>
        {view.updatedAt && (
          <p>
            Zuletzt aktiviert am {new Date(view.updatedAt).toLocaleString('de-DE')} durch{' '}
            {view.updatedBy}.
          </p>
        )}
        {!view.provisioned && (
          <p className="text-danger">
            Das Secret für die SMTP-Konfiguration ist noch nicht angelegt. Bis dahin bleibt dieser
            Bereich schreibgeschützt und der Versand nutzt die Deployment-Umgebung.
          </p>
        )}
      </div>
    </Panel>
  );
}
