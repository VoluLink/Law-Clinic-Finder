/**
 * Bounded request-body reading.
 *
 * `request.json()` and `request.formData()` buffer the entire body before any
 * validator runs, so an unauthenticated caller could make the server hold an
 * arbitrarily large payload in memory. Every handler that reads a body goes
 * through here instead: media type first, then the declared length, then a
 * streaming byte count for bodies that declare none.
 */

/** Generous for every JSON endpoint in this app except the chat. */
export const JSON_BODY_LIMIT = 64 * 1024;

/**
 * The chat schema permits 16 messages of 4000 characters. German, Cyrillic and
 * Arabic cost up to three UTF-8 bytes per character and JSON escaping adds more,
 * so the ceiling is derived from the schema rather than guessed — and the schema
 * still rejects anything the ceiling lets through.
 */
export const CHAT_BODY_LIMIT = 320 * 1024;

export type BodyRejection = 'unsupported_media_type' | 'too_large' | 'malformed';

export type JsonBody = { ok: true; value: unknown } | { ok: false; reason: BodyRejection };

type DeclaredLength = { kind: 'absent' } | { kind: 'valid'; bytes: number } | { kind: 'invalid' };

type BytesResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: BodyRejection };

const REJECTION_STATUS: Record<BodyRejection, number> = {
  unsupported_media_type: 415,
  too_large: 413,
  malformed: 400,
};

const REJECTION_MESSAGE: Record<BodyRejection, string> = {
  unsupported_media_type: 'Nicht unterstütztes Format.',
  too_large: 'Anfrage zu groß.',
  malformed: 'Ungültige Anfrage.',
};

function isJsonMediaType(header: string | null): boolean {
  if (!header) return false;
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

function declaredLength(request: Request): DeclaredLength {
  const raw = request.headers.get('content-length');
  if (raw === null) return { kind: 'absent' };
  const bytes = Number(raw);
  if (!Number.isInteger(bytes) || bytes < 0) return { kind: 'invalid' };
  return { kind: 'valid', bytes };
}

async function readBoundedBytes(
  body: ReadableStream<Uint8Array>,
  limit: number,
): Promise<BytesResult> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { ok: false, reason: 'too_large' };
    }
    chunks.push(value);
  }
  if (total === 0) return { ok: false, reason: 'malformed' };
  return { ok: true, bytes: concat(chunks, total) };
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/** `fatal` matters: silently replacing invalid UTF-8 with U+FFFD would let a
 *  validator inspect different text than the client actually sent. */
function parseJson(bytes: Uint8Array): JsonBody {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export async function readJsonBody(request: Request, limit = JSON_BODY_LIMIT): Promise<JsonBody> {
  if (!isJsonMediaType(request.headers.get('content-type'))) {
    return { ok: false, reason: 'unsupported_media_type' };
  }
  const declared = declaredLength(request);
  if (declared.kind === 'invalid') return { ok: false, reason: 'malformed' };
  if (declared.kind === 'valid' && declared.bytes > limit) {
    return { ok: false, reason: 'too_large' };
  }
  if (!request.body) return { ok: false, reason: 'malformed' };
  const read = await readBoundedBytes(request.body, limit);
  return read.ok ? parseJson(read.bytes) : read;
}

/**
 * Pre-check for multipart uploads, which cannot be streamed past a validator the
 * way JSON can. A request that declares no length is refused rather than
 * buffered and measured afterwards — measuring afterwards is the bug.
 */
export function withinDeclaredLimit(request: Request, limit: number): boolean {
  const declared = declaredLength(request);
  return declared.kind === 'valid' && declared.bytes <= limit;
}

export function bodyRejectionResponse(reason: BodyRejection): Response {
  return Response.json(
    { error: REJECTION_MESSAGE[reason] },
    { status: REJECTION_STATUS[reason], headers: { 'Cache-Control': 'private, no-store' } },
  );
}
