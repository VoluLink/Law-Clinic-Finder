import { z } from 'zod';

export const MAX_CHAT_MESSAGE_CHARS = 4000;
export const MAX_CHAT_MESSAGES = 16;
export const MAX_CHAT_TOTAL_CHARS = 12_000;

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
});

export const chatRequestSchema = z.object({
  // Stable per-chat id from the client, so every turn's tokens accumulate onto
  // one conversation row instead of inserting a fresh row per message-exchange.
  sessionId: z.uuid().optional(),
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(MAX_CHAT_MESSAGES)
    .refine((messages) => totalChars(messages) <= MAX_CHAT_TOTAL_CHARS, {
      message: 'conversation exceeds the total size budget',
    }),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

function totalChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

/**
 * Client-side companion to chatRequestSchema: keeps the most recent messages
 * that fit the message-count and size budgets so long conversations stay
 * sendable. A leading assistant message is dropped afterwards — the Claude API
 * requires the first message to be a user turn.
 */
export function trimChatHistory(messages: ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const size = messages[i].content.length;
    if (kept.length >= MAX_CHAT_MESSAGES || total + size > MAX_CHAT_TOTAL_CHARS) break;
    kept.unshift(messages[i]);
    total += size;
  }
  while (kept[0]?.role === 'assistant') kept.shift();
  return kept;
}
