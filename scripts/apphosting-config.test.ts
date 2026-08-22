import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const appHostingConfigSchema = z.object({
  apphosting: z.object({
    alwaysDeployFromSource: z.boolean(),
    backendId: z.literal('web'),
  }),
});

const firebaseConfig = appHostingConfigSchema.parse(
  JSON.parse(readFileSync('firebase.json', 'utf8')) as unknown,
);

describe('App Hosting source rollout config', () => {
  it('allows deployment from the protected local source', () => {
    expect(firebaseConfig.apphosting.alwaysDeployFromSource).toBe(true);
  });
});
