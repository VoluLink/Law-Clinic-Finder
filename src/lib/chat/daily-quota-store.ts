import { z } from 'zod';

const BERLIN_TIME_ZONE = 'Europe/Berlin';
const MAX_SESSIONS_PER_DAY = 2;
const MAX_TURNS_PER_SESSION = 8;

export const quotaSessionSchema = z.object({
  sessionId: z.string().uuid(),
  turnCount: z.number().int().min(1).max(MAX_TURNS_PER_SESSION),
});

export type QuotaSession = z.infer<typeof quotaSessionSchema>;
export type QuotaWindow = { date: string; resetAt: string };
export type QuotaStoreResult = { allowed: boolean; resetAt: string };

export type DailyQuotaStore = {
  claim: (deviceHash: string, sessionId: string, now: Date) => Promise<QuotaStoreResult>;
};

function berlinParts(instant: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
}

function berlinOffsetMs(instant: Date): number {
  const parts = berlinParts(instant);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function nextBerlinMidnight(parts: Record<string, string>): Date {
  const nextDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1),
  );
  const localMidnightAsUtc = Date.UTC(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth(),
    nextDate.getUTCDate(),
  );
  const firstGuess = new Date(localMidnightAsUtc);
  return new Date(localMidnightAsUtc - berlinOffsetMs(firstGuess));
}

export function quotaWindow(now: Date): QuotaWindow {
  const parts = berlinParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, resetAt: nextBerlinMidnight(parts).toISOString() };
}

export function applyQuotaClaim(
  current: QuotaSession[],
  sessionId: string,
): { allowed: boolean; sessions: QuotaSession[] } {
  const sessions = quotaSessionSchema.array().max(MAX_SESSIONS_PER_DAY).parse(current);
  const index = sessions.findIndex((session) => session.sessionId === sessionId);
  if (index < 0 && sessions.length >= MAX_SESSIONS_PER_DAY) return { allowed: false, sessions };
  if (index >= 0 && sessions[index].turnCount >= MAX_TURNS_PER_SESSION) {
    return { allowed: false, sessions };
  }
  const next = sessions.map((session) => ({ ...session }));
  if (index < 0) next.push({ sessionId, turnCount: 1 });
  else next[index].turnCount += 1;
  return { allowed: true, sessions: next };
}
