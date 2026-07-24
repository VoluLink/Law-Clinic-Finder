import { clientIp } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import type { Logger } from '@/lib/logger';
import type { ScopedRateLimiter } from '@/lib/rate-limit';
import type { ChatSettings, ChatSettingsResult } from '@/lib/settings';

import { redactPatterns } from './redact';
import type { ChatRunResult } from './run-chat';
import { chatRequestSchema, type ChatMessage } from './schema';
import { CHAT_STREAM_CONTENT_TYPE } from './stream-protocol';

export type ChatHandlerDeps = {
  limiter: ScopedRateLimiter;
  loadSettings: () => Promise<ChatSettingsResult>;
  run: (
    settings: ChatSettings,
    messages: ChatMessage[],
  ) => { stream: ReadableStream<Uint8Array> | null; result: Promise<ChatRunResult> };
  persist: (
    transcript: ChatMessage[],
    run: ChatRunResult,
    sessionId: string | null,
  ) => Promise<void>;
  schedule: (task: () => Promise<void>) => void;
  logger: Logger;
};

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

const LIMIT_MESSAGES = {
  minute: 'Zu viele Anfragen. Bitte warte einen Moment.',
  day: 'Tageslimit erreicht. Bitte versuche es morgen erneut.',
} as const;

export async function handleChatRequest(
  request: Request,
  deps: ChatHandlerDeps,
): Promise<Response> {
  if (!isSameOrigin(request)) return jsonError(403, 'Nicht erlaubt.');
  const limitScope = deps.limiter.check(clientIp(request));
  if (limitScope) {
    return Response.json({ error: LIMIT_MESSAGES[limitScope], scope: limitScope }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'Ungültige Anfrage.');
  const loaded = await deps.loadSettings();
  if (!loaded.ok) return jsonError(503, 'Der Chat ist derzeit nicht konfiguriert.');
  if (!loaded.settings.chat_enabled) return jsonError(503, 'Der Chat ist derzeit deaktiviert.');
  // Strip contact details before the text leaves the server, not just before it
  // is stored: the model does not need an email or phone number to name a
  // clinic, so there is no reason to send them to the API at all.
  const messages = parsed.data.messages.map((message) => ({
    role: message.role,
    content: redactPatterns(message.content),
  }));
  const { stream, result } = deps.run(loaded.settings, messages);
  const sessionId = parsed.data.sessionId ?? null;
  deps.schedule(() => finishRun(deps, messages, result, sessionId));
  return new Response(stream, { headers: { 'Content-Type': CHAT_STREAM_CONTENT_TYPE } });
}

async function finishRun(
  deps: ChatHandlerDeps,
  messages: ChatMessage[],
  result: Promise<ChatRunResult>,
  sessionId: string | null,
): Promise<void> {
  try {
    const run = await result;
    await deps.persist(
      [...messages, { role: 'assistant', content: run.assistantText }],
      run,
      sessionId,
    );
  } catch (error) {
    deps.logger.error('chat run failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
