import { clientIp } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import { challengeRequired, verifyChallenge } from '@/lib/security/challenge';
import type { Logger } from '@/lib/logger';
import type { ScopedRateLimiter } from '@/lib/rate-limit';
import type { ChatSettings, ChatSettingsResult } from '@/lib/settings';

import type { DailyQuotaClaim } from './daily-quota';
import { redactPatterns } from './redact';
import type { ChatRunResult } from './run-chat';
import { chatRequestSchema, type ChatMessage, type ChatRequest } from './schema';
import { CHAT_STREAM_CONTENT_TYPE } from './stream-protocol';

export type ChatHandlerDeps = {
  limiter: ScopedRateLimiter;
  /** Injected so tests and the emulator never depend on the live provider. */
  verifyChallenge?: (context: {
    sessionId: string;
    token: string;
    clientIp: string | null;
  }) => Promise<boolean>;
  claimQuota: (request: Request, sessionId: string) => Promise<DailyQuotaClaim>;
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

function responseHeaders(contentType: string, setCookie?: string): Headers {
  const headers = new Headers({ 'Content-Type': contentType });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return headers;
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
  if (limitScope) return burstLimitResponse(limitScope);
  const parsed = await parseChatRequest(request);
  if (!parsed) return jsonError(400, 'Ungültige Anfrage.');
  if (!(await passesChallenge(deps, request, parsed))) {
    return jsonError(403, 'Sicherheitsprüfung fehlgeschlagen. Bitte lade die Seite neu.');
  }
  const loaded = await deps.loadSettings();
  if (!loaded.ok) return jsonError(503, 'Der Chat ist derzeit nicht konfiguriert.');
  if (!loaded.settings.chat_enabled) return jsonError(503, 'Der Chat ist derzeit deaktiviert.');
  const quota = await enforceDailyQuota(deps, request, parsed.sessionId);
  if (quota instanceof Response) return quota;
  return startChat(deps, loaded.settings, parsed, quota);
}

/**
 * Only the opening turn is challenged. Later turns are already bound to a
 * conversation that paid the cost, and re-challenging mid-conversation would
 * interrupt someone describing a legal problem.
 */
function isFirstTurn(parsed: ChatRequest): boolean {
  return parsed.messages.length === 1;
}

async function passesChallenge(
  deps: ChatHandlerDeps,
  request: Request,
  parsed: ChatRequest,
): Promise<boolean> {
  if (!challengeRequired() || !isFirstTurn(parsed)) return true;
  if (!parsed.challenge) return false;
  const verify = deps.verifyChallenge ?? verifyChallenge;
  return verify({
    sessionId: parsed.sessionId,
    token: parsed.challenge,
    clientIp: clientIp(request),
  });
}

async function parseChatRequest(request: Request): Promise<ChatRequest | null> {
  const body = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

async function enforceDailyQuota(deps: ChatHandlerDeps, request: Request, sessionId: string) {
  const quota = await deps.claimQuota(request, sessionId);
  if (!quota.ok) {
    deps.logger.error('chat quota claim failed', { reason: quota.reason });
    return jsonError(503, 'Der Chat ist derzeit nicht verfügbar.');
  }
  if (!quota.allowed) {
    const headers = responseHeaders('application/json', quota.setCookie);
    return Response.json(
      { error: LIMIT_MESSAGES.day, scope: 'day', resetAt: quota.resetAt },
      { status: 429, headers },
    );
  }
  return quota;
}

function startChat(
  deps: ChatHandlerDeps,
  settings: ChatSettings,
  request: ChatRequest,
  quota: Extract<DailyQuotaClaim, { ok: true }>,
): Response {
  // Apply the same deterministic PII boundary before API transit and storage;
  // the chat model never acts as the redactor and never needs the matched data.
  const messages = request.messages.map((message) => ({
    role: message.role,
    content: redactPatterns(message.content),
  }));
  const { stream, result } = deps.run(settings, messages);
  deps.schedule(() => finishRun(deps, messages, result, request.sessionId));
  return new Response(stream, {
    headers: responseHeaders(CHAT_STREAM_CONTENT_TYPE, quota.setCookie),
  });
}

function burstLimitResponse(scope: 'minute' | 'day'): Response {
  return Response.json({ error: LIMIT_MESSAGES[scope], scope }, { status: 429 });
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
