import { z } from 'zod';

import { safeExternalHref, safeMailtoAddress } from '@/lib/http/external-url';
import { stripInvisible } from '@/lib/text/invisible';

/**
 * Newline-delimited JSON frames on the /api/chat response body.
 *
 * The reply used to be raw `text/plain`, which left no room for anything but
 * prose — clinic matches reached the model and stopped there. Framing lets the
 * same stream carry the structured recommendations the UI renders as cards,
 * without a second request or a sentinel hidden in the text.
 */

/**
 * Card text is truncated rather than rejected. `reason` is written by the model
 * and the rest is clinic-authored, so an over-long value is a display problem,
 * not a reason to drop the whole recommendation frame.
 */
const CARD_TEXT_LIMIT = { name: 200, region: 1_000, area: 200, reason: 2_000 } as const;
const MAX_CARD_AREAS = 12;

const cardText = (limit: number) =>
  z.string().transform((value) => stripInvisible(value).slice(0, limit));

const nullableCardText = (limit: number) =>
  z
    .string()
    .nullable()
    .transform((value) => (value === null ? null : stripInvisible(value).slice(0, limit)));

/**
 * Re-validated on the client, not only where the frame is built. The card is
 * the one place where database text becomes an href, and the schema is the last
 * thing that runs before it is rendered.
 */
export const clinicRecommendationSchema = z.object({
  // The directory id, carried so the client can attribute a website/email
  // click back to this clinic. Published clinics are already public, so the id
  // is not sensitive.
  id: z.string().min(1).max(200),
  rank: z.number().int().positive().max(100),
  name: cardText(CARD_TEXT_LIMIT.name),
  region: nullableCardText(CARD_TEXT_LIMIT.region),
  areas: z
    .array(cardText(CARD_TEXT_LIMIT.area))
    .transform((areas) => areas.slice(0, MAX_CARD_AREAS)),
  reason: cardText(CARD_TEXT_LIMIT.reason),
  website: z.string().nullable().transform(safeExternalHref),
  email: z.string().nullable().transform(safeMailtoAddress),
});

export type ClinicRecommendation = z.infer<typeof clinicRecommendationSchema>;

/**
 * Why the reply stopped. The frame carries a code rather than a message: the
 * wording is app-owned and localised, and a model or provider string must never
 * reach the visitor. Aborting the HTTP body instead would leave a half-written
 * bubble with nothing to explain it.
 */
export const CHAT_ERROR_CODES = [
  'overloaded',
  'rate_limited',
  'unavailable',
  'timeout',
  'internal',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

const chatEventSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('text'), v: z.string().transform(stripInvisible) }),
  z.object({ t: z.literal('clinics'), v: z.array(clinicRecommendationSchema) }),
  // Signals that the assistant concluded no clinic fits; the client shows a
  // fixed "ways forward" card. Carries no payload — its copy is app-owned.
  z.object({ t: z.literal('nomatch') }),
  z.object({ t: z.literal('error'), code: z.enum(CHAT_ERROR_CODES) }),
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
