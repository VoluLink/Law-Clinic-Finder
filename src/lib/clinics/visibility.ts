import { z } from 'zod';

/**
 * Self-service visibility for a clinic member. Hiding is never destructive: the
 * entry and its login stay intact and only `isPublished` changes, so an entry can
 * come back exactly as it was. Deleting the account is the separate, heavier path.
 */
export const MIN_HIDDEN_DAYS = 1;
export const MAX_HIDDEN_DAYS = 365;

export type VisibilityState = 'visible' | 'temporary' | 'permanent';

export const visibilityRequestSchema = z
  .object({
    state: z.enum(['visible', 'temporary', 'permanent']),
    /** Local calendar day the entry should reappear; required for 'temporary'. */
    until: z.iso.date().nullish(),
  })
  .strict()
  .refine((value) => value.state !== 'temporary' || Boolean(value.until), {
    path: ['until'],
    message: 'A temporary pause needs a return date',
  });

export type VisibilityRequest = z.infer<typeof visibilityRequestSchema>;

const MS_PER_DAY = 86_400_000;

/** End of the chosen day in UTC, so an entry chosen for "1 March" stays hidden
 *  through that whole day wherever the reader is. */
export function hiddenUntilDate(until: string): Date {
  return new Date(`${until}T23:59:59.999Z`);
}

export function isWithinAllowedRange(until: string, now: Date): boolean {
  const days = (hiddenUntilDate(until).getTime() - now.getTime()) / MS_PER_DAY;
  return days >= MIN_HIDDEN_DAYS - 1 && days <= MAX_HIDDEN_DAYS;
}

export type VisibilityUpdate = {
  isPublished: boolean;
  hiddenUntil: Date | null;
  hiddenReason: 'temporary' | 'permanent' | null;
};

export function visibilityUpdate(request: VisibilityRequest): VisibilityUpdate {
  if (request.state === 'visible') {
    return { isPublished: true, hiddenUntil: null, hiddenReason: null };
  }
  if (request.state === 'permanent') {
    return { isPublished: false, hiddenUntil: null, hiddenReason: 'permanent' };
  }
  return {
    isPublished: false,
    hiddenUntil: hiddenUntilDate(request.until ?? ''),
    hiddenReason: 'temporary',
  };
}

export function currentVisibility(clinic: {
  isPublished: boolean;
  hiddenReason?: 'temporary' | 'permanent' | null;
}): VisibilityState {
  if (clinic.isPublished) return 'visible';
  return clinic.hiddenReason === 'temporary' ? 'temporary' : 'permanent';
}
