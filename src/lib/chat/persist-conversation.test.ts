import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LogLine } from '@/lib/logger';

import { persistConversation, type PersistDeps } from './persist-conversation';

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
  insertError?: { message: string };
  redactStatus?: 'ok' | 'failed';
}) {
  // conversations.insert(...).select('id').single()
  const conversationInsert = vi.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({ data: { id: 'conv-1' }, error: overrides?.insertError ?? null }),
    }),
  }));
  const eventsInsert = vi.fn().mockResolvedValue({ error: null });
  const lines: LogLine[] = [];
  const deps: PersistDeps = {
    adminClient: {
      from: vi.fn((table: string) =>
        table === 'clinic_events' ? { insert: eventsInsert } : { insert: conversationInsert },
      ),
    } as never,
    redact: vi
      .fn()
      .mockResolvedValue(
        overrides?.redactStatus === 'failed'
          ? { status: 'failed' }
          : { status: 'ok', transcript, legalArea: 'Mietrecht', city: 'Berlin' },
      ),
    logger: createLogger({}, (line) => lines.push(line)),
  };
  return { deps, insert: conversationInsert, eventsInsert, lines };
}

describe(persistConversation, () => {
  it('stores the redacted transcript with stats fields', async () => {
    const { deps, insert } = createDeps();
    await persistConversation(deps, transcript, run);
    expect(insert).toHaveBeenCalledWith({
      redacted_transcript: transcript,
      redaction_status: 'ok',
      detected_legal_area: 'Mietrecht',
      detected_city: 'Berlin',
      matched_clinic_count: 2,
      message_count: 2,
      model: 'claude-haiku-4-5-20251001',
      input_tokens: 1200,
      output_tokens: 340,
    });
  });

  it('stores a stats-only row when redaction fails', async () => {
    const { deps, insert } = createDeps({ redactStatus: 'failed' });
    await persistConversation(deps, transcript, run);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ redacted_transcript: null, redaction_status: 'failed' }),
    );
  });

  it('logs an insert failure without throwing or leaking content', async () => {
    const { deps, lines } = createDeps({ insertError: { message: 'db down' } });
    await persistConversation(deps, transcript, run);
    expect(lines[0]).toMatchObject({ level: 'error' });
    expect(JSON.stringify(lines)).not.toContain('Antwort');
  });

  it('records one recommendation event per clinic shown', async () => {
    const { deps, eventsInsert } = createDeps();
    await persistConversation(deps, transcript, { ...run, recommendedClinicIds: ['a1', 'b2'] });
    expect(eventsInsert).toHaveBeenCalledWith([
      { clinic_id: 'a1', kind: 'recommended', conversation_id: 'conv-1' },
      { clinic_id: 'b2', kind: 'recommended', conversation_id: 'conv-1' },
    ]);
  });

  it('writes no events when nothing was recommended', async () => {
    const { deps, eventsInsert } = createDeps();
    await persistConversation(deps, transcript, run);
    expect(eventsInsert).not.toHaveBeenCalled();
  });
});
