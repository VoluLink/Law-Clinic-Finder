import { z } from 'zod';

import type { Logger } from '@/lib/logger';

import type { DirectoryMatch } from './directory';

export const signupSearchSchema = z.object({ query: z.string().trim().max(200) });

export type SignupDirectoryStore = {
  search: (query: string) => Promise<DirectoryMatch[]>;
};

export type SignupDeps = { store: SignupDirectoryStore; logger: Logger };

export async function searchDirectory(
  deps: SignupDeps,
  query: string,
): Promise<DirectoryMatch[] | null> {
  try {
    return await deps.store.search(signupSearchSchema.shape.query.parse(query));
  } catch (error) {
    deps.logger.warn('signup search failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}
