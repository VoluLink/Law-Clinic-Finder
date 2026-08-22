import { z } from 'zod';

import type { LogLevel, LogLine, WriteLine } from '@/lib/logger';

const RETENTION_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export type StoredLog = {
  id: string;
  logged_at: string;
  level: LogLevel;
  msg: string;
  fields: Record<string, unknown> | null;
};

export type NewStoredLog = Omit<StoredLog, 'id'> & { expires_at: string };

export type LogRepository = {
  write: (log: NewStoredLog) => Promise<void>;
  list: (limit: number) => Promise<StoredLog[]>;
  clear: () => Promise<void>;
};

export type LogStoreDeps = {
  repository: LogRepository;
  retentionDays?: number;
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
  return {
    persist: (line) => {
      const write = async () => deps.repository.write(storedLog(line, retentionDays));
      void write().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : 'unknown';
        process.stderr.write(`log store failed: ${reason}\n`);
      });
    },
  };
}
