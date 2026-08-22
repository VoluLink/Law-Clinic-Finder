import { z } from 'zod';

import { logger, type Logger } from '@/lib/logger';

type RandomId = () => string;
type HeaderSource = { headers: { get(name: string): string | null } };

const requestIdSchema = z.uuid();

function correlationId(request: HeaderSource | undefined, randomId: RandomId): string {
  const parsed = requestIdSchema.safeParse(request?.headers.get('x-request-id'));
  return parsed.success ? parsed.data : randomId();
}

export function requestLogger(
  request?: HeaderSource,
  baseLogger: Logger = logger,
  randomId: RandomId = () => crypto.randomUUID(),
): Logger {
  return baseLogger.child({ requestId: correlationId(request, randomId) });
}
