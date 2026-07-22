'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { LogLevel } from '@/lib/logger';

export type LogRow = {
  id: string;
  logged_at: string;
  level: LogLevel;
  msg: string;
  fields: Record<string, unknown> | null;
};

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];

const LEVEL_VARIANT: Record<LogLevel, BadgeVariant> = {
  error: 'danger',
  warn: 'warning',
  info: 'neutral',
  debug: 'neutral',
};

const COPIED_RESET_MS = 2000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function matches(row: LogRow, level: string, search: string): boolean {
  if (level !== 'all' && row.level !== level) return false;
  if (!search) return true;
  const haystack = `${row.msg} ${row.fields ? JSON.stringify(row.fields) : ''}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

/** One JSON object per line — the exact shape the logger emits, ready to paste. */
function toNdjson(rows: LogRow[]): string {
  return rows
    .map((row) =>
      JSON.stringify({
        logged_at: row.logged_at,
        level: row.level,
        msg: row.msg,
        ...(row.fields ?? {}),
      }),
    )
    .join('\n');
}

export function LogsList({ logs }: { logs: LogRow[] }) {
  const router = useRouter();
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(
    () => logs.filter((row) => matches(row, level, search)),
    [logs, level, search],
  );

  async function copyForLlm() {
    try {
      await navigator.clipboard.writeText(toNdjson(filtered));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      setCopied(false);
    }
  }

  async function clearAll() {
    if (!window.confirm('Alle Protokolle endgültig löschen?')) return;
    await fetch('/api/admin/logs', { method: 'DELETE' }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Level"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          options={[
            { value: 'all', label: 'Alle' },
            ...LEVELS.map((value) => ({ value, label: value })),
          ]}
        />
        <div className="min-w-[220px] flex-1">
          <Input
            label="Protokolle durchsuchen"
            labelHidden
            placeholder="In Nachricht und Feldern suchen …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={copyForLlm} disabled={filtered.length === 0}>
          {copied ? 'Kopiert ✓' : 'Für LLM kopieren'}
        </Button>
        <Button variant="danger" onClick={clearAll} disabled={logs.length === 0}>
          Alle löschen
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">
          {logs.length === 0
            ? 'Noch keine Protokolle vorhanden.'
            : 'Keine Treffer für diesen Filter.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => (
            <LogCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({ row }: { row: LogRow }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={LEVEL_VARIANT[row.level]}>{row.level.toUpperCase()}</Badge>
        <span className="text-sm text-muted">{formatDate(row.logged_at)}</span>
        <span className="text-sm font-medium text-foreground">{row.msg}</span>
      </div>
      {row.fields && (
        <pre className="overflow-x-auto rounded-lg bg-surface-tint p-3 text-xs text-muted">
          {JSON.stringify(row.fields, null, 2)}
        </pre>
      )}
    </Card>
  );
}
