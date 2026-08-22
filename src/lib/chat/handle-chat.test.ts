import { describe, expect, it, vi } from 'vitest';

import { combineRateLimiters, createRateLimiter, type RateLimitConfig } from '@/lib/rate-limit';
import { makeChatSettings } from '@/lib/settings.fixtures';

import { handleChatRequest, type ChatHandlerDeps } from './handle-chat';

const sessionId = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const validBody = { sessionId, messages: [{ role: 'user', content: 'Hilfe bei Mietrecht?' }] };
const settings = makeChatSettings();

function chatRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.7, 192.0.2.1',
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
    claimQuota: vi.fn().mockResolvedValue({
      ok: true,
      allowed: true,
      scope: null,
      resetAt: '2026-08-16T22:00:00.000Z',
    }),
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

  it('rejects a third conversation before starting the model', async () => {
    const deps = createDeps({
      claimQuota: vi.fn().mockResolvedValue({
        ok: true,
        allowed: false,
        scope: 'day',
        resetAt: '2026-08-16T22:00:00.000Z',
      }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      scope: 'day',
      resetAt: '2026-08-16T22:00:00.000Z',
    });
    expect(deps.run).not.toHaveBeenCalled();
  });

  it('fails closed when the quota store is unavailable', async () => {
    const deps = createDeps({
      claimQuota: vi.fn().mockResolvedValue({ ok: false, reason: 'database unavailable' }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.status).toBe(503);
    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith('chat quota claim failed', {
      reason: 'database unavailable',
    });
  });

  it('sets the opaque quota cookie before streaming starts', async () => {
    const deps = createDeps({
      claimQuota: vi.fn().mockResolvedValue({
        ok: true,
        allowed: true,
        scope: null,
        resetAt: '2026-08-16T22:00:00.000Z',
        setCookie: 'lcf_chat_quota=opaque; HttpOnly',
      }),
    });
    const response = await handleChatRequest(chatRequest(validBody), deps);
    expect(response.headers.get('set-cookie')).toBe('lcf_chat_quota=opaque; HttpOnly');
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
      sessionId,
    );
  });

  it('forwards the client session id to persistence', async () => {
    const deps = createDeps();
    await handleChatRequest(chatRequest(validBody), deps);
    await vi.waitFor(() => expect(deps.persist).toHaveBeenCalled());
    expect(deps.persist).toHaveBeenCalledWith(expect.anything(), expect.anything(), sessionId);
  });

  it('strips sensitive details before the messages reach the model', async () => {
    const deps = createDeps();
    const body = {
      sessionId,
      messages: [
        {
          role: 'user',
          content:
            'Ich heiße Anna Beispiel, wohne in der Musterstraße 12 und bin unter 0221 4567890 erreichbar.',
        },
      ],
    };
    await handleChatRequest(chatRequest(body), deps);
    expect(deps.run).toHaveBeenCalledWith(settings, [
      {
        role: 'user',
        content: 'Ich heiße [NAME], wohne in der [ADRESSE] und bin unter [TELEFON] erreichbar.',
      },
    ]);
  });

  it('persists the redacted text, not what the user typed', async () => {
    const deps = createDeps();
    const body = {
      sessionId,
      messages: [{ role: 'user', content: 'Meine Mail: anna@example.org' }],
    };
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
