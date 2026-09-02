import { afterEach, describe, expect, it, vi } from 'vitest';

import { REGION_SUGGESTIONS } from '@/lib/clinics/options';

import {
  deidentifyMessages,
  DLP_INFO_TYPES,
  FORBIDDEN_INFO_TYPES,
  type DeidentifyResult,
} from './deidentify';

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

function useDlp(): void {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('REDACTION_PROVIDER', 'dlp');
  vi.stubEnv('FIREBASE_PROJECT_ID', PROJECT);
}

function user(...contents: string[]) {
  return contents.map((content) => ({ role: 'user' as const, content }));
}

/** Mirrors DLP's table response shape for the values it is handed back. */
function dlpTable(...values: string[]) {
  return Response.json({
    item: { table: { rows: values.map((value) => ({ values: [{ stringValue: value }] })) } },
  });
}

function stubFetch(...responses: Response[]) {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

function requestBody(mock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(String(mock.mock.calls[call][1].body));
}

function reasonOf(result: DeidentifyResult): string {
  return result.ok ? 'ok' : result.reason;
}

describe('DLP configuration', () => {
  // Enabling any of these would strip the place a visitor named, and the finder
  // cannot match a clinic to someone whose location it no longer knows.
  it.each(FORBIDDEN_INFO_TYPES)('never requests %s', (forbidden) => {
    expect(DLP_INFO_TYPES).not.toContain(forbidden);
  });

  it('requests the German identifier detectors', () => {
    expect(DLP_INFO_TYPES).toContain('GERMANY_TAXPAYER_IDENTIFICATION_NUMBER');
    expect(DLP_INFO_TYPES).toContain('GERMANY_IDENTITY_CARD_NUMBER');
  });
});

describe(deidentifyMessages, () => {
  it('refuses when no provider is configured', async () => {
    const fetchMock = stubFetch();
    vi.stubEnv('NODE_ENV', 'production');
    const result = await deidentifyMessages(user('Hallo'));
    expect(reasonOf(result)).toBe('unconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses when the project is unknown', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REDACTION_PROVIDER', 'dlp');
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('unconfigured');
  });

  it('returns the text DLP produced', async () => {
    useDlp();
    stubFetch(dlpTable('Mein Name ist [PERSON_NAME].'));
    const result = await deidentifyMessages(user('Mein Name ist Max Mustermann.'));
    expect(result).toEqual({
      ok: true,
      messages: [{ role: 'user', content: 'Mein Name ist [PERSON_NAME].' }],
    });
  });

  it('sends the whole transcript as one request', async () => {
    useDlp();
    const fetchMock = stubFetch(dlpTable('eins', 'zwei', 'drei'));
    await deidentifyMessages(user('eins', 'zwei', 'drei'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(fetchMock).item.table.rows).toHaveLength(3);
  });

  it('processes inside the configured region', async () => {
    useDlp();
    vi.stubEnv('DLP_LOCATION', 'europe-west4');
    const fetchMock = stubFetch(dlpTable('ok'));
    await deidentifyMessages(user('Hallo'));
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `projects/${PROJECT}/locations/europe-west4/content:deidentify`,
    );
  });

  it.each(['attacker.example.org', '../../v2', 'europe west4'])(
    'refuses the turn rather than posting the transcript when DLP_LOCATION is %j',
    async (location) => {
      useDlp();
      vi.stubEnv('DLP_LOCATION', location);
      const fetchMock = stubFetch(dlpTable('ok'));
      expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('unconfigured');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('requests no location detector', async () => {
    useDlp();
    const fetchMock = stubFetch(dlpTable('ok'));
    await deidentifyMessages(user('Hallo'));
    const requested = requestBody(fetchMock).inspectConfig.infoTypes.map(
      (type: { name: string }) => type.name,
    );
    for (const forbidden of FORBIDDEN_INFO_TYPES) expect(requested).not.toContain(forbidden);
  });

  it('excludes the finder’s own region vocabulary from name detection', async () => {
    useDlp();
    const fetchMock = stubFetch(dlpTable('ok'));
    await deidentifyMessages(user('Hallo'));
    const [rule] = requestBody(fetchMock).inspectConfig.ruleSet;
    expect(rule.infoTypes).toEqual([{ name: 'PERSON_NAME' }]);
    expect(rule.rules[0].exclusionRule.dictionary.wordList.words).toEqual([...REGION_SUGGESTIONS]);
  });

  it('asks for full matches only, the sole kind a hotword exclusion accepts', async () => {
    useDlp();
    const fetchMock = stubFetch(dlpTable('ok'));
    await deidentifyMessages(user('Hallo'));
    const [rule] = requestBody(fetchMock).inspectConfig.ruleSet;
    const matchingTypes = rule.rules.map(
      (entry: { exclusionRule: { matchingType: string } }) => entry.exclusionRule.matchingType,
    );
    expect(matchingTypes).toEqual(['MATCHING_TYPE_FULL_MATCH', 'MATCHING_TYPE_FULL_MATCH']);
  });

  it('refuses a response that removed a postal code', async () => {
    useDlp();
    stubFetch(dlpTable('Ich wohne in [LOCATION].'));
    expect(reasonOf(await deidentifyMessages(user('Ich wohne in 50667 Köln.')))).toBe('rejected');
  });

  it('refuses a response that removed a region name', async () => {
    useDlp();
    stubFetch(dlpTable('Ich wohne in [PERSON_NAME].'));
    expect(reasonOf(await deidentifyMessages(user('Ich wohne in Bayern.')))).toBe('rejected');
  });

  it('keeps a postal code and city that DLP left alone', async () => {
    useDlp();
    stubFetch(dlpTable('Ich wohne in 50667 Köln.'));
    const result = await deidentifyMessages(user('Ich wohne in 50667 Köln.'));
    expect(result).toEqual({
      ok: true,
      messages: [{ role: 'user', content: 'Ich wohne in 50667 Köln.' }],
    });
  });

  it('refuses when DLP rejects the request', async () => {
    useDlp();
    const fetchMock = stubFetch(new Response(null, { status: 400 }));
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once, then refuses, when DLP is unavailable', async () => {
    useDlp();
    const fetchMock = stubFetch(
      new Response(null, { status: 503 }),
      new Response(null, { status: 503 }),
    );
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers when a retry succeeds', async () => {
    useDlp();
    stubFetch(new Response(null, { status: 500 }), dlpTable('geprüft'));
    const result = await deidentifyMessages(user('Hallo'));
    expect(result).toEqual({ ok: true, messages: [{ role: 'user', content: 'geprüft' }] });
  });

  it('refuses when DLP is unreachable', async () => {
    useDlp();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('unavailable');
  });

  it('refuses when DLP returns an unexpected body', async () => {
    useDlp();
    stubFetch(Response.json({ unexpected: true }));
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('rejected');
  });

  it('refuses when DLP returns the wrong number of rows', async () => {
    useDlp();
    stubFetch(dlpTable('nur eine'));
    expect(reasonOf(await deidentifyMessages(user('eins', 'zwei')))).toBe('rejected');
  });

  it('never returns the original text on any failure', async () => {
    useDlp();
    const secret = 'max@example.org';
    for (const response of [
      new Response(null, { status: 400 }),
      Response.json({ unexpected: true }),
      dlpTable('[LOCATION]'),
    ]) {
      stubFetch(response, response);
      const result = await deidentifyMessages(user(`Schreib an ${secret} aus 50667 Köln.`));
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
});

describe('development bypass', () => {
  it('passes text through untouched outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('REDACTION_PROVIDER', 'none');
    const fetchMock = stubFetch();
    const result = await deidentifyMessages(user('Mein Name ist Max.'));
    expect(result).toEqual({
      ok: true,
      messages: [{ role: 'user', content: 'Mein Name ist Max.' }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cannot be switched on in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REDACTION_PROVIDER', 'none');
    expect(reasonOf(await deidentifyMessages(user('Hallo')))).toBe('unconfigured');
  });
});
