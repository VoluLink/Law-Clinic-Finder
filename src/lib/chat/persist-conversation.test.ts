import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogLine } from '@/lib/logger';

import { persistConversation, type PersistDeps } from './persist-conversation';

const sessionId = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const transcript = [
  { role: 'user' as const, content: 'Frage' },
  { role: 'assistant' as const, content: 'Antwort' },
];
const run = {
  matchedClinicCount: 2,
  detectedLegalArea: 'Arbeitsrecht',
  recommendedClinicIds: [] as string[],
  model: 'claude-haiku-4-5-20251001',
  inputTokens: 1200,
  outputTokens: 340,
};

function createDeps(overrides?: {
  rpcError?: { message: string };
  redactStatus?: 'ok' | 'failed';
}) {
  const record = overrides?.rpcError
    ? vi.fn().mockRejectedValue(new Error(overrides.rpcError.message))
    : vi.fn().mockResolvedValue(undefined);
  const lines: LogLine[] = [];
  const deps: PersistDeps = {
    store: { record },
    redact: vi
      .fn()
      .mockResolvedValue(
        overrides?.redactStatus === 'failed'
          ? { status: 'failed' }
          : { status: 'ok', transcript, legalArea: 'Mietrecht', city: 'Berlin' },
      ),
    logger: createLogger({}, (line) => lines.push(line)),
  };
  return { deps, record, lines };
}

describe(persistConversation, () => {
  it('upserts the whole chat by session id with its redacted transcript and tokens', async () => {
    const { deps, record } = createDeps();
    await persistConversation(deps, transcript, run, sessionId);
    expect(record).toHaveBeenCalledWith({
      sessionId,
      redactedTranscript: transcript,
      redactionStatus: 'ok',
      detectedLegalArea: 'Arbeitsrecht',
      detectedCity: 'Berlin',
      matchedClinicCount: 2,
      messageCount: 2,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1200,
      outputTokens: 340,
      recommendedClinicIds: [],
    });
  });

  it('passes a null session id straight through (legacy fallback)', async () => {
    const { deps, record } = createDeps();
    await persistConversation(deps, transcript, run, null);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ sessionId: null }));
  });

  it('sends a stats-only row when redaction fails', async () => {
    const { deps, record } = createDeps({ redactStatus: 'failed' });
    await persistConversation(deps, transcript, run, sessionId);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ redactedTranscript: null, redactionStatus: 'failed' }),
    );
  });

  it('forwards the recommended clinic ids for the RPC to dedupe', async () => {
    const { deps, record } = createDeps();
    await persistConversation(
      deps,
      transcript,
      { ...run, recommendedClinicIds: ['a1', 'b2'] },
      sessionId,
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ recommendedClinicIds: ['a1', 'b2'] }),
    );
  });

  it('falls back to the locally detected area when no search area was captured', async () => {
    const { deps, record } = createDeps();
    await persistConversation(deps, transcript, { ...run, detectedLegalArea: null }, sessionId);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ detectedLegalArea: 'Mietrecht' }),
    );
  });

  it('logs a persist failure without throwing or leaking content', async () => {
    const { deps, lines } = createDeps({ rpcError: { message: 'db down' } });
    await persistConversation(deps, transcript, run, sessionId);
    expect(lines[0]).toMatchObject({ level: 'error' });
    expect(JSON.stringify(lines)).not.toContain('Antwort');
  });
});
