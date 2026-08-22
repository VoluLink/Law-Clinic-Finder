import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  options: [] as unknown[],
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    constructor(options: unknown) {
      auth.options.push(options);
    }
    getAccessToken = auth.getAccessToken;
  },
}));

const warn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));

import { loadGaMetrics, resetGaMetricsCache } from './ga-metrics';

const PROPERTY_ID = '412345678';
const MEASUREMENT_ID = 'G-ABC1234567';
const SERVICE_ACCOUNT_JSON = JSON.stringify({
  client_email: 'ga-reader@example-project.iam.gserviceaccount.com',
  private_key: 'test-private-key-material',
  project_id: 'example-project',
});
const ACCESS_TOKEN = 'test-access-token';
const RUN_REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
const ANALYTICS_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const WARNING = 'ga metrics unavailable';

const USERS = 1_234;
const SESSIONS = 2_468;
/** The API reports fractional seconds; the reader rounds them to whole ones. */
const AVERAGE_SESSION_RAW = '95.4';
const AVERAGE_SESSION_SECONDS = 95;

const LEAP_FEBRUARY = '2024-02';
const LEAP_FEBRUARY_RANGE = { startDate: '2024-02-01', endDate: '2024-02-29' };
const EXPECTED_REQUEST = {
  dateRanges: [LEAP_FEBRUARY_RANGE],
  metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'averageSessionDuration' }],
  limit: 1,
};

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
/** Comfortably past the reader's internal request deadline. */
const BEYOND_DEADLINE_MS = 60_000;

/** Only the members the reader touches — `Response` is not guaranteed in the
 *  jsdom test environment. */
function reportResponse(body: unknown, status = HTTP_OK): Response {
  return {
    ok: status === HTTP_OK,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function successBody(users = USERS, sessions = SESSIONS): unknown {
  return {
    rows: [
      {
        metricValues: [
          { value: String(users) },
          { value: String(sessions) },
          { value: AVERAGE_SESSION_RAW },
        ],
      },
    ],
  };
}

const fetchMock = vi.fn<typeof fetch>();

describe('loadGaMetrics', () => {
  beforeEach(() => {
    resetGaMetricsCache();
    warn.mockReset();
    auth.options.length = 0;
    auth.getAccessToken.mockReset().mockResolvedValue(ACCESS_TOKEN);
    fetchMock.mockReset().mockResolvedValue(reportResponse(successBody()));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GA_PROPERTY_ID', PROPERTY_ID);
    vi.stubEnv('GA_SERVICE_ACCOUNT_JSON', SERVICE_ACCOUNT_JSON);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns null without calling the API while the integration is unconfigured', async () => {
    vi.stubEnv('GA_PROPERTY_ID', '');

    expect(await loadGaMetrics()).toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: 'not configured' });
  });

  it('returns the metrics carried by the run report response', async () => {
    const metrics = await loadGaMetrics();

    expect(metrics?.users).toBe(USERS);
    expect(metrics?.sessions).toBe(SESSIONS);
    expect(metrics?.avgEngagementSeconds).toBe(AVERAGE_SESSION_SECONDS);
  });

  it('reports zeroes for a month the property has no rows for', async () => {
    fetchMock.mockResolvedValue(reportResponse({ rowCount: 0 }));

    expect(await loadGaMetrics()).toEqual({ users: 0, sessions: 0, avgEngagementSeconds: 0 });
  });

  it('translates the month key into an inclusive date range', async () => {
    await loadGaMetrics(LEAP_FEBRUARY);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RUN_REPORT_URL);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(EXPECTED_REQUEST);
  });

  it('authorises the request with a read-only analytics token', async () => {
    await loadGaMetrics();

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      authorization: `Bearer ${ACCESS_TOKEN}`,
    });
    expect(auth.options[0]).toMatchObject({ scopes: [ANALYTICS_READONLY_SCOPE] });
  });

  it('returns null and warns when the report body does not match the schema', async () => {
    fetchMock.mockResolvedValue(reportResponse({ rows: [{ metricValues: [{ value: 'n/a' }] }] }));

    expect(await loadGaMetrics()).toBe(null);
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: 'malformed report' });
  });

  it('returns null and warns when the Data API rejects the request', async () => {
    fetchMock.mockResolvedValue(reportResponse({}, HTTP_FORBIDDEN));

    expect(await loadGaMetrics()).toBe(null);
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: `http ${HTTP_FORBIDDEN}` });
  });

  it('returns null and warns when the request outlives its deadline', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = loadGaMetrics();
    await vi.advanceTimersByTimeAsync(BEYOND_DEADLINE_MS);

    expect(await pending).toBe(null);
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: 'timeout' });
  });

  it('returns null and warns when the measurement id is used as the property id', async () => {
    vi.stubEnv('GA_PROPERTY_ID', MEASUREMENT_ID);

    expect(await loadGaMetrics()).toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: 'invalid property id' });
  });

  it('returns null and warns when the service account JSON is unusable', async () => {
    vi.stubEnv('GA_SERVICE_ACCOUNT_JSON', '{"client_email":"not-an-email"}');

    expect(await loadGaMetrics()).toBe(null);
    expect(warn).toHaveBeenCalledWith(WARNING, { reason: 'invalid credentials' });
  });

  it('serves the cached month without a second request', async () => {
    await loadGaMetrics(LEAP_FEBRUARY);
    await loadGaMetrics(LEAP_FEBRUARY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests the report again after resetGaMetricsCache', async () => {
    await loadGaMetrics(LEAP_FEBRUARY);
    resetGaMetricsCache();
    await loadGaMetrics(LEAP_FEBRUARY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
