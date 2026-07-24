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
  recommendedClinicIds: [] as string[],
  model: 'claude-haiku-4-5-20251001',
  inputTokens: 1200,
  outputTokens: 340,
};

function createDeps(overrides?: {
  rpcError?: { message: string };
  redactStatus?: 'ok' | 'failed';
}) {
  const rpc = vi.fn().mockResolvedValue({ data: 'conv-1', error: overrides?.rpcError ?? null });
  const lines: LogLine[] = [];
  const deps: PersistDeps = {
    adminClient: { rpc } as never,
    redact: vi
      .fn()
      .mockResolvedValue(
        overrides?.redactStatus === 'failed'
          ? { status: 'failed' }
          : { status: 'ok', transcript, legalArea: 'Mietrecht', city: 'Berlin' },
      ),
    logger: createLogger({}, (line) => lines.push(line)),
  };
  return { deps, rpc, lines };
}

describe(persistConversation, () => {
  it('upserts the whole chat by session id with its redacted transcript and tokens', async () => {
    const { deps, rpc } = createDeps();
    await persistConversation(deps, transcript, run, sessionId);
    expect(rpc).toHaveBeenCalledWith('record_conversation', {
      p_session_id: sessionId,
      p_redacted_transcript: transcript,
      p_redaction_status: 'ok',
      p_detected_legal_area: 'Mietrecht',
      p_detected_city: 'Berlin',
      p_matched_clinic_count: 2,
      p_message_count: 2,
      p_model: 'claude-haiku-4-5-20251001',
      p_input_tokens: 1200,
      p_output_tokens: 340,
      p_recommended_clinic_ids: [],
    });
  });

  it('passes a null session id straight through (legacy fallback)', async () => {
    const { deps, rpc } = createDeps();
    await persistConversation(deps, transcript, run, null);
    expect(rpc).toHaveBeenCalledWith(
      'record_conversation',
      expect.objectContaining({ p_session_id: null }),
    );
  });

  it('sends a stats-only row when redaction fails', async () => {
    const { deps, rpc } = createDeps({ redactStatus: 'failed' });
    await persistConversation(deps, transcript, run, sessionId);
    expect(rpc).toHaveBeenCalledWith(
      'record_conversation',
      expect.objectContaining({ p_redacted_transcript: null, p_redaction_status: 'failed' }),
    );
  });

  it('forwards the recommended clinic ids for the RPC to dedupe', async () => {
    const { deps, rpc } = createDeps();
    await persistConversation(
      deps,
      transcript,
      { ...run, recommendedClinicIds: ['a1', 'b2'] },
      sessionId,
    );
    expect(rpc).toHaveBeenCalledWith(
      'record_conversation',
      expect.objectContaining({ p_recommended_clinic_ids: ['a1', 'b2'] }),
    );
  });

  it('logs a persist failure without throwing or leaking content', async () => {
    const { deps, lines } = createDeps({ rpcError: { message: 'db down' } });
    await persistConversation(deps, transcript, run, sessionId);
    expect(lines[0]).toMatchObject({ level: 'error' });
    expect(JSON.stringify(lines)).not.toContain('Antwort');
  });
});
