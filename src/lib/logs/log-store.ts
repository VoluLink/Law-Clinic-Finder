import { z } from 'zod';

import type { LogLevel, LogLine, WriteLine } from '@/lib/logger';

const RETENTION_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** Ascending severity; a line persists when its rank meets the threshold. */
const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/*
 * Only warnings and errors reach Firestore by default. Every persisted line is a
 * document write, and `info` covers routine events like "signed out" — paying a
 * write for each one buys nothing the admin view needs, while Cloud Logging keeps
 * the full stream on stdout within its free tier. Lower it via LOG_PERSIST_LEVEL
 * when diagnosing something specific.
 */
const DEFAULT_PERSIST_LEVEL: LogLevel = 'warn';
const persistLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).catch(DEFAULT_PERSIST_LEVEL);

function persistLevel(configured: LogLevel | undefined): LogLevel {
  return configured ?? persistLevelSchema.parse(process.env.LOG_PERSIST_LEVEL);
}

export type StoredLog = {
  id: string;
  logged_at: string;
  level: LogLevel;
  msg: string;
  fields: Record<string, unknown> | null;
};

export type NewStoredLog = Omit<StoredLog, 'id'> & { expires_at: string };

/** One page of the admin log view. `unreadable` counts rows that failed
 *  validation, so a silent gap is reported rather than hidden. */
export type LogPage = {
  logs: StoredLog[];
  unreadable: number;
  cursor: string | null;
  exhausted: boolean;
};

export type LogRepository = {
  write: (log: NewStoredLog) => Promise<void>;
  list: (limit: number) => Promise<StoredLog[]>;
  listPage: (limit: number, before?: Date) => Promise<LogPage>;
  clear: () => Promise<void>;
};

export type LogStoreDeps = {
  repository: LogRepository;
  retentionDays?: number;
  /** Lowest level written to Firestore; defaults to LOG_PERSIST_LEVEL or `warn`. */
  minLevel?: LogLevel;
};

const fieldsSchema = z.record(z.string().max(100), z.json());

function storedLog(line: LogLine, retentionDays: number): NewStoredLog {
  const { timestamp, level, msg, ...rawFields } = line;
  const fields = fieldsSchema.parse(rawFields);
  const expiresAt = new Date(new Date(timestamp).getTime() + retentionDays * MS_PER_DAY);
  return {
    logged_at: z.iso.datetime({ offset: true }).parse(timestamp),
    level,
    msg: z.string().min(1).max(1000).parse(msg),
    fields: Object.keys(fields).length > 0 ? fields : null,
    expires_at: expiresAt.toISOString(),
  };
}

export function createLogStore(deps: LogStoreDeps): { persist: WriteLine } {
  const retentionDays = deps.retentionDays ?? RETENTION_DAYS;
  const threshold = LEVEL_RANK[persistLevel(deps.minLevel)];
  return {
    persist: (line) => {
      if (LEVEL_RANK[line.level] < threshold) return;
      const write = async () => deps.repository.write(storedLog(line, retentionDays));
      void write().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : 'unknown';
        process.stderr.write(`log store failed: ${reason}\n`);
      });
    },
  };
}
