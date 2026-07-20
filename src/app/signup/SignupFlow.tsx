'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { DirectoryMatch } from '@/lib/signup/directory';
import type { ClaimResult } from '@/lib/signup/handle-claim';

import { RegisterForm } from './RegisterForm';
import { BackLink, StageHeading } from '@/components/ui/StageShell';

type Stage =
  | { name: 'search' }
  | { name: 'claim'; clinic: DirectoryMatch; fromCollision: boolean }
  | { name: 'verify'; clinic: DirectoryMatch; maskedEmail: string }
  | { name: 'register' }
  | { name: 'done' };

const GENERIC_ERROR = 'Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.';
const SEARCH_DEBOUNCE_MS = 300;

async function requestClaim(clinicId: string): Promise<ClaimResult> {
  try {
    const response = await fetch('/api/signup/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId }),
    });
    const body = (await response.json().catch(() => null)) as ClaimResult | null;
    return body && 'status' in body ? body : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

export function SignupFlow() {
  const [stage, setStage] = useState<Stage>({ name: 'search' });

  if (stage.name === 'claim') {
    return (
      <ClaimStage
        clinic={stage.clinic}
        fromCollision={stage.fromCollision}
        onSent={(maskedEmail) => setStage({ name: 'verify', clinic: stage.clinic, maskedEmail })}
        onBack={() => setStage({ name: 'search' })}
      />
    );
  }
  if (stage.name === 'verify')
    return <VerifyStage maskedEmail={stage.maskedEmail} clinic={stage.clinic} />;
  if (stage.name === 'register') {
    return (
      <RegisterForm
        onDone={() => setStage({ name: 'done' })}
        onCollision={(clinic) => setStage({ name: 'claim', clinic, fromCollision: true })}
        onBack={() => setStage({ name: 'search' })}
      />
    );
  }
  if (stage.name === 'done') return <DoneStage />;
  return (
    <SearchStage
      onClaim={(clinic) => setStage({ name: 'claim', clinic, fromCollision: false })}
      onRegister={() => setStage({ name: 'register' })}
    />
  );
}

const MagnifierIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7.5" cy="7.5" r="5.5" />
    <path d="M11.5 11.5 16 16" strokeLinecap="round" />
  </svg>
);

async function fetchDirectory(query: string, signal: AbortSignal): Promise<DirectoryMatch[]> {
  const response = await fetch('/api/signup/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error('search failed');
  const body = (await response.json()) as { results: DirectoryMatch[] };
  return body.results;
}

function SearchStage({
  onClaim,
  onRegister,
}: {
  onClaim: (clinic: DirectoryMatch) => void;
  onRegister: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    // The directory is listed unfiltered on mount, so the first load skips the
    // debounce; later keystrokes wait it out to stay inside the per-IP limit.
    const delay = firstRun.current ? 0 : SEARCH_DEBOUNCE_MS;
    firstRun.current = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchDirectory(query.trim(), controller.signal).then(
        (found) => {
          // A superseded request must never overwrite newer results, even if
          // it resolves anyway rather than rejecting on abort.
          if (controller.signal.aborted) return;
          setResults(found);
          setError(null);
        },
        () => {
          if (!controller.signal.aborted) setError(GENERIC_ERROR);
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <Card variant="panel" className="flex flex-col gap-5">
      <BackLink href="/" />
      <div className="flex flex-col gap-2">
        <StageHeading>Finde deine Law Clinic</StageHeading>
        <p className="text-base text-muted">
          Suche im Verzeichnis nach dem Namen deiner Law Clinic, um sie zu übernehmen.
        </p>
      </div>
      <Input
        label="Name der Law Clinic"
        labelHidden
        shape="pill"
        leadingIcon={MagnifierIcon}
        placeholder="Name der Law Clinic…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        error={error ?? undefined}
      />
      <SearchResults results={results} onClaim={onClaim} />
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <p className="text-sm text-muted">Deine Law Clinic ist nicht dabei?</p>
        <Button variant="accent" onClick={onRegister} className="w-full py-4 text-base font-bold">
          + Neue Law Clinic eintragen
        </Button>
      </div>
    </Card>
  );
}

function SearchResults({
  results,
  onClaim,
}: {
  results: DirectoryMatch[] | null;
  onClaim: (clinic: DirectoryMatch) => void;
}) {
  if (results === null) return null;
  if (results.length === 0) {
    return <p className="text-sm text-muted">Keine Einträge gefunden.</p>;
  }
  return (
    <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
      {results.map((clinic) => (
        <li
          key={clinic.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border px-5 py-4"
        >
          <span className="truncate text-[17px] font-bold text-primary">{clinic.name}</span>
          {clinic.claimed ? (
            <span className="flex shrink-0 items-center gap-3">
              <Badge variant="success">bereits aktiv</Badge>
              <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
                Mit E-Mail anmelden →
              </Link>
            </span>
          ) : (
            <Button shape="pill" onClick={() => onClaim(clinic)} className="shrink-0 px-6 py-3">
              Das ist meine
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ClaimStage({
  clinic,
  fromCollision,
  onSent,
  onBack,
}: {
  clinic: DirectoryMatch;
  fromCollision: boolean;
  onSent: (maskedEmail: string) => void;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClaim() {
    setPending(true);
    const result = await requestClaim(clinic.id);
    setPending(false);
    if (result.status === 'sent') return onSent(result.maskedEmail);
    setMessage(claimMessage(result));
  }

  return (
    <Card variant="panel" className="flex flex-col gap-5">
      <BackLink onClick={onBack} />
      {fromCollision && (
        <p className="rounded-xl border border-primary/20 bg-accent p-4 text-sm text-foreground">
          Eine Law Clinic mit diesem Namen ist bereits im Verzeichnis. Übernimm stattdessen den
          bestehenden Eintrag.
        </p>
      )}
      <StageHeading>{clinic.name}</StageHeading>
      {clinic.hasContactEmail ? (
        <p className="text-base text-muted">
          Zur Bestätigung senden wir einen Anmeldelink an die hinterlegte Adresse{' '}
          <strong className="text-foreground">{clinic.maskedEmail}</strong>. Nur wer dieses Postfach
          liest, kann den Eintrag übernehmen.
        </p>
      ) : (
        <p className="text-base text-muted">
          Für diesen Eintrag ist keine E-Mail-Adresse hinterlegt. Bitte kontaktieren Sie Law Clinics
          Deutschland, um den Zugang einzurichten.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-danger">
          {message}
        </p>
      )}
      {clinic.hasContactEmail && (
        <Button
          onClick={handleClaim}
          disabled={pending}
          shape="pill"
          className="w-full py-4 text-base font-bold"
        >
          Anmeldelink anfordern
        </Button>
      )}
    </Card>
  );
}

function claimMessage(result: ClaimResult): string {
  if (result.status === 'already_claimed') {
    return 'Diese Law Clinic ist bereits aktiv. Melden Sie sich mit der E-Mail-Adresse Ihrer Organisation an.';
  }
  if (result.status === 'blocked') {
    return `Für diesen Eintrag wurden bereits mehrere Links angefordert. Bitte versuchen Sie es in ${result.retryDays} Tagen erneut.`;
  }
  if (result.status === 'no_email') {
    return 'Für diesen Eintrag ist keine E-Mail-Adresse hinterlegt. Bitte kontaktieren Sie Law Clinics Deutschland.';
  }
  return GENERIC_ERROR;
}

function VerifyStage({ clinic, maskedEmail }: { clinic: DirectoryMatch; maskedEmail: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleResend() {
    setPending(true);
    const result = await requestClaim(clinic.id);
    setPending(false);
    setStatus(result.status === 'sent' ? 'Link erneut gesendet.' : claimMessage(result));
  }

  return (
    <Card variant="panel" className="flex flex-col gap-5">
      <StageHeading>Prüfen Sie Ihr Postfach</StageHeading>
      <p className="text-base text-muted">
        Wir haben einen Anmeldelink an <strong className="text-foreground">{maskedEmail}</strong>{' '}
        gesendet. Öffnen Sie den Link, um den Zugang für {clinic.name} zu aktivieren.
      </p>
      {status && (
        <p role="status" className="text-sm text-foreground">
          {status}
        </p>
      )}
      <Button variant="accent" onClick={handleResend} disabled={pending} className="w-full py-4">
        Link erneut senden
      </Button>
    </Card>
  );
}

function DoneStage() {
  return (
    <Card variant="panel" className="flex flex-col gap-5">
      <StageHeading>Vielen Dank!</StageHeading>
      <p className="text-base text-muted">
        Ihre Law Clinic wurde zur Prüfung eingereicht. Das Team von Law Clinics Deutschland schaltet
        den Eintrag frei — danach erhalten Sie den Anmeldelink an die angegebene E-Mail-Adresse.
      </p>
      <BackLink href="/" />
    </Card>
  );
}
