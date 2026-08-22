import { describe, expect, it } from 'vitest';

import {
  chatRequestSchema,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_TOTAL_CHARS,
  trimChatHistory,
  type ChatMessage,
} from './schema';

const validMessage = { role: 'user', content: 'Ich suche eine Law Clinic in Berlin' };
const validSessionId = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';

function message(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

function alternating(count: number, contentLength = 10): ChatMessage[] {
  return Array.from({ length: count }, (_, i) =>
    message(i % 2 === 0 ? 'user' : 'assistant', 'a'.repeat(contentLength)),
  );
}

describe('chatRequestSchema', () => {
  it('accepts a valid request', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: [validMessage],
    });
    expect(result.success).toBe(true);
  });

  it('requires a uuid sessionId for per-conversation quota enforcement', () => {
    expect(chatRequestSchema.safeParse({ messages: [validMessage] }).success).toBe(false);
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: [validMessage],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a sessionId that is not a uuid', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: 'not-a-uuid',
      messages: [validMessage],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty messages array', () => {
    const result = chatRequestSchema.safeParse({ sessionId: validSessionId, messages: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more messages than the budget allows', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: alternating(MAX_CHAT_MESSAGES + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown roles', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: [{ role: 'system', content: 'evil override' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty message content', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: [{ role: 'user', content: '  ' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects content longer than the per-message cap', () => {
    const result = chatRequestSchema.safeParse({
      sessionId: validSessionId,
      messages: [{ role: 'user', content: 'a'.repeat(MAX_CHAT_MESSAGE_CHARS + 1) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects conversations over the total character budget', () => {
    const messages = alternating(4, MAX_CHAT_MESSAGE_CHARS);
    expect(messages.length * MAX_CHAT_MESSAGE_CHARS).toBeGreaterThan(MAX_CHAT_TOTAL_CHARS);
    const result = chatRequestSchema.safeParse({ sessionId: validSessionId, messages });
    expect(result.success).toBe(false);
  });

  it('accepts conversations exactly at the total character budget', () => {
    const messages = alternating(3, MAX_CHAT_MESSAGE_CHARS);
    expect(messages.length * MAX_CHAT_MESSAGE_CHARS).toBe(MAX_CHAT_TOTAL_CHARS);
    const result = chatRequestSchema.safeParse({ sessionId: validSessionId, messages });
    expect(result.success).toBe(true);
  });
});

describe(trimChatHistory, () => {
  it('keeps a short conversation unchanged', () => {
    const messages = alternating(4);
    expect(trimChatHistory(messages)).toEqual(messages);
  });

  it('keeps only the most recent messages within the message budget', () => {
    const messages = alternating(MAX_CHAT_MESSAGES + 4);
    const trimmed = trimChatHistory(messages);
    expect(trimmed).toEqual(messages.slice(4));
    expect(trimmed[0].role).toBe('user');
  });

  it('drops a leading assistant message left over after trimming', () => {
    const messages = alternating(MAX_CHAT_MESSAGES + 1);
    const trimmed = trimChatHistory(messages);
    expect(trimmed).toEqual(messages.slice(2));
    expect(trimmed[0].role).toBe('user');
  });

  it('respects the total character budget', () => {
    const messages = alternating(4, MAX_CHAT_MESSAGE_CHARS);
    const trimmed = trimChatHistory(messages);
    expect(trimmed).toEqual(messages.slice(2));
  });
});
