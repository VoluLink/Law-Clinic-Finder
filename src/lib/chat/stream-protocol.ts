import { z } from 'zod';

/**
 * Newline-delimited JSON frames on the /api/chat response body.
 *
 * The reply used to be raw `text/plain`, which left no room for anything but
 * prose — clinic matches reached the model and stopped there. Framing lets the
 * same stream carry the structured recommendations the UI renders as cards,
 * without a second request or a sentinel hidden in the text.
 */

export const clinicRecommendationSchema = z.object({
  rank: z.number().int().positive(),
  name: z.string().min(1),
  region: z.string().nullable(),
  areas: z.array(z.string()),
  reason: z.string(),
  website: z.string().nullable(),
  email: z.string().nullable(),
});

export type ClinicRecommendation = z.infer<typeof clinicRecommendationSchema>;

const chatEventSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('text'), v: z.string() }),
  z.object({ t: z.literal('clinics'), v: z.array(clinicRecommendationSchema) }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;

export const CHAT_STREAM_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8';

/** JSON.stringify escapes newlines, so the payload can never split its own frame. */
export function encodeChatEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Decodes whole frames and hands back the unterminated remainder, which the
 * caller prepends to the next chunk. Unparseable or unknown frames are skipped
 * rather than thrown: a forward-compatible client should keep rendering the
 * text it can understand instead of failing the whole reply.
 */
export function decodeChatEvents(buffer: string): { events: ChatEvent[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events = lines.flatMap((line) => {
    if (!line.trim()) return [];
    const parsed = chatEventSchema.safeParse(safeJsonParse(line));
    return parsed.success ? [parsed.data] : [];
  });
  return { events, rest };
}

function safeJsonParse(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
