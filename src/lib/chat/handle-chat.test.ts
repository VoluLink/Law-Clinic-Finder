import { describe, expect, it, vi } from 'vitest';

import { combineRateLimiters, createRateLimiter, type RateLimitConfig } from '@/lib/rate-limit';
import { makeChatSettings } from '@/lib/settings.fixtures';

import { handleChatRequest, type ChatHandlerDeps } from './handle-chat';

const validBody = { messages: [{ role: 'user', content: 'Hilfe bei Mietrecht?' }] };
const settings = makeChatSettings();

function chatRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
      origin: 'http://localhost',
      host: 'localhost',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function minuteLimiter(config: RateLimitConfig) {
  return combineRateLimiters({ scope: 'minute', limiter: createRateLimiter(config) });
}

function createDeps(overrides?: Partial<ChatHandlerDeps>): ChatHandlerDeps {
  return {
    limiter: minuteLimiter({ maxRequests: 100, windowMs: 60_000 }),
    loadSettings: vi.fn().mockResolvedValue({ ok: true, settings }),
    run: vi.fn().mockReturnValue({
      stream: new Response('Antwort').body,
      result: Promise.resolve({
        assistantText: 'Antwort',
        matchedClinicCount: 1,
        toolCallCount: 1,
        model: settings.chat_model,
      }),
    }),
    persist: vi.fn().mockResolvedValue(undefined),
    schedule: (task) => void task(),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
    ...overrides,
  };
}

describe(handleChatRequest, () => {
  it('rejects invalid bodies with 400', async () => {
    const response = await handleChatRequest(chatRequest({ messages: [] }), createDeps());
    expect(response.status).toBe(400);
  });

  it('rejects cross-origin requests with 403', async () => {
    const request = chatRequest(validBody, { origin: 'https://evil.example' });
    const response = await handleChatRequest(request, createDeps());
    expect(response.status).toBe(403);
  });

  it('rejects requests without an Origin header with 403', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', host: 'localhost' },
      body: JSON.stringify(validBody),
    });
    const response = await handleChatRequest(request, createDeps());
    expect(response.status).toBe(403);
  });

  it('rejects rate-limited clients with 429 and the blocking scope', async () => {
    const deps = createDeps({ limiter: minuteLimiter({ maxRequests: 1, windowMs: 60_000 }) });
    await handleChatRequest(chatRequest(validBody), deps);
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ scope: 'minute' });
  });

  it('reports the day scope when the daily budget is used up', async () => {
    const deps = createDeps({
      limiter: combineRateLimiters({
        scope: 'day',
        limiter: createRateLimiter({ maxRequests: 1, windowMs: 86_400_000 }),
      }),
    });
    await handleChatRequest(chatRequest(validBody), deps);
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ scope: 'day' });
  });

  it('returns 503 when the chat is disabled', async () => {
    const deps = createDeps({
      loadSettings: vi.fn().mockResolvedValue({
        ok: true,
        settings: makeChatSettings({ chat_enabled: false }),
      }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(503);
  });

  it('returns 503 when the settings are unconfigured (missing prompt)', async () => {
    const deps = createDeps({
      loadSettings: vi.fn().mockResolvedValue({ ok: false, missing: ['chat_system_prompt'] }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(503);
  });

  it('streams the reply and schedules persistence with the full transcript', async () => {
    const deps = createDeps();
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Antwort');
    await vi.waitFor(() => expect(deps.persist).toHaveBeenCalled());
    expect(deps.persist).toHaveBeenCalledWith(
      [
        { role: 'user', content: 'Hilfe bei Mietrecht?' },
        { role: 'assistant', content: 'Antwort' },
      ],
      expect.objectContaining({ matchedClinicCount: 1 }),
    );
  });

  it('strips contact details before the messages reach the model', async () => {
    const deps = createDeps();
    const body = {
      messages: [{ role: 'user', content: 'Schreiben Sie an anna@example.de oder 0221 4567890.' }],
    };
    await handleChatRequest(chatRequest(body), deps);
    expect(deps.run).toHaveBeenCalledWith(settings, [
      { role: 'user', content: 'Schreiben Sie an [E-MAIL] oder [TELEFON].' },
    ]);
  });

  it('persists the redacted text, not what the user typed', async () => {
    const deps = createDeps();
    const body = { messages: [{ role: 'user', content: 'Meine Mail: anna@example.de' }] };
    await handleChatRequest(chatRequest(body), deps);
    await vi.waitFor(() => expect(deps.persist).toHaveBeenCalled());
    const [transcript] = vi.mocked(deps.persist).mock.calls[0];
    expect(transcript[0].content).toBe('Meine Mail: [E-MAIL]');
  });

  it('logs instead of throwing when the run fails after streaming started', async () => {
    const deps = createDeps({
      run: vi.fn().mockReturnValue({
        stream: new Response('').body,
        result: Promise.reject(new Error('api down')),
      }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(deps.logger.error).toHaveBeenCalled());
    expect(deps.persist).not.toHaveBeenCalled();
  });
});
