import { afterEach, describe, expect, it, vi } from 'vitest';

import { deidentify, DLP_INFO_TYPES, FORBIDDEN_INFO_TYPES, redactionProvider } from './deidentify';

const PROJECT = 'law-clinic-finder';

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken = async () => 'token';
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function dlpResponse(value: string) {
  return Response.json({ item: { value } });
}

describe(redactionProvider, () => {
  it('defaults to the local engine', () => {
    expect(redactionProvider()).toBe('local');
  });

  it('falls back to local for an unknown provider', () => {
    vi.stubEnv('REDACTION_PROVIDER', 'presidio');
    expect(redactionProvider()).toBe('local');
  });
});

describe('DLP info types', () => {
  // Enabling any of these would strip the city, and the finder cannot match a
  // clinic to someone whose location it no longer knows.
  it.each(FORBIDDEN_INFO_TYPES)('never requests %s', (forbidden) => {
    expect(DLP_INFO_TYPES).not.toContain(forbidden);
  });

  it('requests the German identifier detectors', () => {
    expect(DLP_INFO_TYPES).toContain('GERMANY_TAXPAYER_IDENTIFICATION_NUMBER');
    expect(DLP_INFO_TYPES).toContain('GERMANY_IDENTITY_CARD_NUMBER');
  });
});

describe(deidentify, () => {
  it('applies the local engine when no provider is configured', async () => {
    await expect(deidentify('Schreib mir an max@example.org bitte.')).resolves.toContain(
      '[E-MAIL]',
    );
  });

  it('never calls out when the provider is local', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await deidentify('Hallo');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the locally redacted text, not the original, to DLP', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    const fetchMock = vi.fn().mockResolvedValue(dlpResponse('geprüft'));
    vi.stubGlobal('fetch', fetchMock);

    await deidentify('Schreib mir an max@example.org.', PROJECT);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.item.value).toContain('[E-MAIL]');
    expect(body.item.value).not.toContain('max@example.org');
  });

  it('keeps the city in the text handed to DLP', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    const fetchMock = vi.fn().mockResolvedValue(dlpResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await deidentify('Ich wohne in 50667 Köln.', PROJECT);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.item.value).toContain('Köln');
  });

  it('requests no location detector', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    const fetchMock = vi.fn().mockResolvedValue(dlpResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await deidentify('Hallo', PROJECT);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const requested = body.inspectConfig.infoTypes.map((type: { name: string }) => type.name);
    for (const forbidden of FORBIDDEN_INFO_TYPES) expect(requested).not.toContain(forbidden);
  });

  it('returns the de-identified text DLP produced', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(dlpResponse('Mein Name ist [PERSON_NAME].')));
    await expect(deidentify('Mein Name ist Max Mustermann.', PROJECT)).resolves.toBe(
      'Mein Name ist [PERSON_NAME].',
    );
  });

  it('degrades to the local result when DLP errors, never to raw text', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const result = await deidentify('Schreib mir an max@example.org.', PROJECT);
    expect(result).toContain('[E-MAIL]');
    expect(result).not.toContain('max@example.org');
  });

  it('degrades to the local result when DLP is unreachable', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(deidentify('max@example.org', PROJECT)).resolves.toContain('[E-MAIL]');
  });

  it('degrades to the local result when the project is unknown', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(deidentify('max@example.org')).resolves.toContain('[E-MAIL]');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades to the local result when DLP returns an unexpected body', async () => {
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ unexpected: true })));
    await expect(deidentify('max@example.org', PROJECT)).resolves.toContain('[E-MAIL]');
  });
});
