import { describe, expect, it, vi } from 'vitest';

import { bodyRejectionResponse, JSON_BODY_LIMIT, readJsonBody, withinDeclaredLimit } from './body';

const URL_UNDER_TEST = 'http://localhost/api/thing';

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

/** A body with no declared length, so only the streaming guard can stop it. */
function streamedRequest(chunks: Uint8Array[], headers: Record<string, string> = {}): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request(URL_UNDER_TEST, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: stream,
    // @ts-expect-error -- undici requires this for a stream body; it is not in the DOM lib types.
    duplex: 'half',
  });
}

function bytes(count: number): Uint8Array {
  return new TextEncoder().encode('x'.repeat(count));
}

describe(readJsonBody, () => {
  it('parses a well-formed body', async () => {
    const result = await readJsonBody(jsonRequest('{"a":1}'));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('accepts a media type carrying a charset parameter', async () => {
    const request = jsonRequest('{"a":1}', { 'content-type': 'application/json; charset=utf-8' });
    expect(await readJsonBody(request)).toEqual({ ok: true, value: { a: 1 } });
  });

  it.each([
    ['text/plain', 'text/plain'],
    ['form encoding', 'application/x-www-form-urlencoded'],
  ])('rejects %s', async (_label, contentType) => {
    const request = jsonRequest('{"a":1}', { 'content-type': contentType });
    expect(await readJsonBody(request)).toEqual({
      ok: false,
      reason: 'unsupported_media_type',
    });
  });

  it('rejects a body with no media type at all', async () => {
    const request = new Request(URL_UNDER_TEST, { method: 'POST', body: '{"a":1}' });
    request.headers.delete('content-type');
    expect(await readJsonBody(request)).toMatchObject({ reason: 'unsupported_media_type' });
  });

  /* The point of the declared-length check is that an oversized upload is
   * refused before a single byte is buffered. */
  it('refuses an oversized declared length without reading the body', async () => {
    const request = jsonRequest('{"a":1}', { 'content-length': String(JSON_BODY_LIMIT + 1) });
    const read = vi.spyOn(request, 'body', 'get');
    expect(await readJsonBody(request)).toEqual({ ok: false, reason: 'too_large' });
    expect(read).not.toHaveBeenCalled();
  });

  it('refuses a body that outgrows the limit mid-stream', async () => {
    const request = streamedRequest([bytes(40), bytes(40)]);
    expect(await readJsonBody(request, 64)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('accepts a streamed body that stays inside the limit', async () => {
    const encoded = new TextEncoder().encode('{"a":1}');
    expect(await readJsonBody(streamedRequest([encoded]), 64)).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it('rejects a non-numeric declared length', async () => {
    const request = jsonRequest('{"a":1}', { 'content-length': 'not-a-number' });
    expect(await readJsonBody(request)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects malformed JSON', async () => {
    expect(await readJsonBody(jsonRequest('{"a":'))).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects an empty body', async () => {
    expect(await readJsonBody(jsonRequest(''))).toEqual({ ok: false, reason: 'malformed' });
  });

  /* Lone surrogates and truncated multi-byte sequences must not be silently
   * replaced with U+FFFD, or a validator can see different text than was sent. */
  it('rejects invalid UTF-8', async () => {
    const request = streamedRequest([new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d])]);
    expect(await readJsonBody(request)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe(withinDeclaredLimit, () => {
  it('permits a declared length inside the ceiling', () => {
    const request = new Request(URL_UNDER_TEST, {
      method: 'POST',
      headers: { 'content-length': '512' },
    });
    expect(withinDeclaredLimit(request, 1024)).toBe(true);
  });

  it('refuses a declared length above the ceiling', () => {
    const request = new Request(URL_UNDER_TEST, {
      method: 'POST',
      headers: { 'content-length': '2048' },
    });
    expect(withinDeclaredLimit(request, 1024)).toBe(false);
  });

  /* A multipart upload with no declared length cannot be pre-checked, so it is
   * refused rather than buffered and measured afterwards. */
  it('refuses a body that declares no length', () => {
    const request = new Request(URL_UNDER_TEST, { method: 'POST' });
    expect(withinDeclaredLimit(request, 1024)).toBe(false);
  });
});

describe(bodyRejectionResponse, () => {
  it.each([
    ['unsupported_media_type', 415],
    ['too_large', 413],
    ['malformed', 400],
  ] as const)('answers %s with %i', async (reason, status) => {
    expect(bodyRejectionResponse(reason).status).toBe(status);
  });

  it('marks the answer non-cacheable', () => {
    expect(bodyRejectionResponse('malformed').headers.get('Cache-Control')).toBe(
      'private, no-store',
    );
  });

  it('says nothing about why beyond the category', async () => {
    const body = await bodyRejectionResponse('too_large').json();
    expect(body).toEqual({ error: 'Anfrage zu groß.' });
  });
});
