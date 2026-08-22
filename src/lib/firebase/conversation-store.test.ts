import { describe, expect, it } from 'vitest';

import type { ConversationRecord } from '@/lib/chat/persist-conversation';

import {
  conversationMetricDeltas,
  mergeConversation,
  transcriptExpiry,
  updateTranscriptRetention,
} from './conversation-store';

const now = new Date('2026-08-16T10:00:00.000Z');
const record: ConversationRecord = {
  sessionId: '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607',
  redactedTranscript: [
    { role: 'user', content: 'Frage' },
    { role: 'assistant', content: 'Antwort' },
  ],
  redactionStatus: 'ok',
  detectedLegalArea: 'Mietrecht',
  detectedCity: 'Berlin',
  matchedClinicCount: 1,
  messageCount: 2,
  model: 'claude-haiku-4-5-20251001',
  inputTokens: 100,
  outputTokens: 20,
  recommendedClinicIds: ['11111111-1111-4111-8111-111111111111'],
};

describe(mergeConversation, () => {
  it('creates a privacy-safe summary for a new chat', () => {
    expect(mergeConversation(null, record, now)).toMatchObject({
      sessionId: record.sessionId,
      redactionStatus: 'ok',
      inputTokens: 100,
      outputTokens: 20,
      hasTranscript: true,
      createdAt: now,
    });
  });

  it('accumulates tokens and de-duplicates recommendations', () => {
    const existing = mergeConversation(null, record, now);
    const merged = mergeConversation(existing, record, new Date(now.getTime() + 1000));
    expect(merged.inputTokens).toBe(200);
    expect(merged.recommendedClinicIds).toEqual(record.recommendedClinicIds);
  });

  it('tracks token usage by model across turns', () => {
    const existing = mergeConversation(null, record, now);
    const second = {
      ...record,
      model: 'claude-sonnet-4-20250514',
      inputTokens: 50,
      outputTokens: 10,
    };
    expect(mergeConversation(existing, second, now).modelUsage).toEqual({
      'claude-haiku-4-5-20251001': { inputTokens: 100, outputTokens: 20 },
      'claude-sonnet-4-20250514': { inputTokens: 50, outputTokens: 10 },
    });
  });

  it('does not erase a good transcript after a later redaction failure', () => {
    const existing = mergeConversation(null, record, now);
    const failed = { ...record, redactedTranscript: null, redactionStatus: 'failed' as const };
    expect(mergeConversation(existing, failed, now).hasTranscript).toBe(true);
  });
});

describe(conversationMetricDeltas, () => {
  it('reverses the monthly counters represented by one summary', () => {
    const summary = mergeConversation(null, record, now);
    expect(conversationMetricDeltas(summary)).toMatchObject({
      conversationCount: -1,
      matchedConversationCount: -1,
      inputTokens: -100,
      outputTokens: -20,
      day: '2026-08-16',
      legalArea: { label: 'Mietrecht', count: -1 },
      modelUsage: {
        'claude-haiku-4-5-20251001': {
          inputTokens: -100,
          outputTokens: -20,
        },
      },
    });
  });
});

describe(updateTranscriptRetention, () => {
  it('evicts the oldest transcript after the cap is exceeded', () => {
    const entries = Array.from({ length: 200 }, (_, index) => ({
      id: `conversation-${index}`,
      createdAtMs: index,
    }));
    const result = updateTranscriptRetention(entries, 'new-conversation', 201);
    expect(result.evictedId).toBe('conversation-0');
    expect(result.entries).toHaveLength(200);
  });

  it('does not duplicate an existing conversation entry', () => {
    const entries = [{ id: 'conversation-1', createdAtMs: 1 }];
    expect(updateTranscriptRetention(entries, 'conversation-1', 1).entries).toEqual(entries);
  });

  it('evicts a reintroduced old conversation instead of a newer transcript', () => {
    const entries = Array.from({ length: 200 }, (_, index) => ({
      id: `conversation-${index}`,
      createdAtMs: index + 100,
    }));
    const result = updateTranscriptRetention(entries, 'old-conversation', 1);
    expect(result.evictedId).toBe('old-conversation');
    expect(result.entries.some((entry) => entry.id === 'old-conversation')).toBe(false);
  });
});

describe(transcriptExpiry, () => {
  const CREATED_AT = new Date('2026-08-23T12:00:00.000Z');
  const DAYS = 90;
  const MS_PER_DAY = 86_400_000;

  it('expires readable message text after ninety days', () => {
    expect(transcriptExpiry(CREATED_AT).getTime()).toBe(CREATED_AT.getTime() + DAYS * MS_PER_DAY);
  });

  it('expires sooner than the statistics derived from it', () => {
    const summaryRetentionDays = 366;
    expect(transcriptExpiry(CREATED_AT).getTime()).toBeLessThan(
      CREATED_AT.getTime() + summaryRetentionDays * MS_PER_DAY,
    );
  });
});
