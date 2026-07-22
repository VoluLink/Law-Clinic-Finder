import { z } from 'zod';

import { REDACTION_SYSTEM_PROMPT } from './prompts';
import type { ChatMessage } from './schema';

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_PATTERN = /(?:\+49|0049|0)[\d\s\-/()]{6,}\d/g;

export const REDACTION_MODEL = 'claude-haiku-4-5-20251001';

// Deterministic pre/post-pass: guarantees emails and phone numbers are gone
// even when the redaction model misses them.
export function redactPatterns(text: string): string {
  return text.replace(EMAIL_PATTERN, '[E-MAIL]').replace(PHONE_PATTERN, '[TELEFON]');
}

const redactedMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
});

const redactionOutputSchema = z.object({
  messages: z.array(redactedMessageSchema),
  legal_area: z.string().nullable(),
  city: z.string().nullable(),
});

export type RedactionOutcome =
  | { status: 'ok'; transcript: ChatMessage[]; legalArea: string | null; city: string | null }
  | { status: 'failed' };

export type RedactionModel = (transcriptJson: string) => Promise<string>;

export async function redactTranscript(
  complete: RedactionModel,
  transcript: ChatMessage[],
): Promise<RedactionOutcome> {
  try {
    const prePassed = transcript.map((m) => ({ role: m.role, content: redactPatterns(m.content) }));
    const raw = await complete(JSON.stringify({ messages: prePassed }));
    const parsed = redactionOutputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.messages.length !== transcript.length) {
      return { status: 'failed' };
    }
    const messages = parsed.data.messages.map((m) => ({
      role: m.role,
      content: redactPatterns(m.content),
    }));
    return {
      status: 'ok',
      transcript: messages,
      legalArea: parsed.data.legal_area,
      city: parsed.data.city,
    };
  } catch {
    // Handled by the caller: a failed redaction stores a stats-only row.
    return { status: 'failed' };
  }
}

type AnthropicCompleteLike = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: 'user'; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
};

export function createRedactionModel(anthropic: AnthropicCompleteLike): RedactionModel {
  return async (transcriptJson) => {
    const response = await anthropic.messages.create({
      model: REDACTION_MODEL,
      max_tokens: 8192,
      system: REDACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcriptJson }],
    });
    const block = response.content.find((b) => b.type === 'text');
    return block?.text ?? '';
  };
}
