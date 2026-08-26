import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  SecretConfigurationError,
  accessSecretVersion,
  addSecretVersion,
  listEnabledVersions,
} from './secret-manager';

vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken() {
      return Promise.resolve('test-token');
    }
  },
}));

const valid = { projectId: 'law-clinic-finder', secretId: 'smtpSettings', location: null };

function stubFetch(payload: unknown) {
  const requested: string[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    requested.push(String(url));
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, requested };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('secret URL construction', () => {
  it('addresses the global endpoint when the secret has no location', async () => {
    const { requested } = stubFetch({ versions: [] });
    await listEnabledVersions(valid);
    expect(requested[0]).toBe(
      'https://secretmanager.googleapis.com/v1/projects/law-clinic-finder/secrets/smtpSettings/versions?pageSize=10',
    );
  });

  it('addresses the regional endpoint when the secret has one', async () => {
    const { requested } = stubFetch({ versions: [] });
    await listEnabledVersions({ ...valid, location: 'europe-west4' });
    expect(requested[0]).toBe(
      'https://secretmanager.europe-west4.rep.googleapis.com/v1/projects/law-clinic-finder/locations/europe-west4/secrets/smtpSettings/versions?pageSize=10',
    );
  });

  it.each(['attacker.example.org', 'europe-west4.attacker', '../../..', 'a/b'])(
    'sends no token at all when the location is %j',
    async (location) => {
      const { fetcher } = stubFetch({ versions: [] });
      await expect(listEnabledVersions({ ...valid, location })).rejects.toBeInstanceOf(
        SecretConfigurationError,
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('refuses a secret id that would escape its path segment', async () => {
    const { fetcher } = stubFetch({ versions: [] });
    await expect(
      addSecretVersion({ ...valid, secretId: '../../other' }, 'x'),
    ).rejects.toBeInstanceOf(SecretConfigurationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a version that would append a second operation to the URL', async () => {
    const { fetcher } = stubFetch({ payload: { data: '' } });
    await expect(accessSecretVersion(valid, '1:destroy')).rejects.toBeInstanceOf(
      SecretConfigurationError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads the requested version when everything is well formed', async () => {
    const data = Buffer.from('payload', 'utf8').toString('base64');
    const { requested } = stubFetch({ payload: { data } });
    await expect(accessSecretVersion(valid, 'latest')).resolves.toBe('payload');
    expect(requested[0]).toContain('/secrets/smtpSettings/versions/latest:access');
  });
});
