import { describe, expect, it } from 'vitest';

import {
  currentVisibility,
  hiddenUntilDate,
  isWithinAllowedRange,
  MAX_HIDDEN_DAYS,
  visibilityRequestSchema,
  visibilityUpdate,
} from './visibility';

const NOW = new Date('2026-08-23T10:00:00.000Z');
const RETURN_DAY = '2026-09-15';

describe('visibilityRequestSchema', () => {
  it('rejects a temporary pause without a return date', () => {
    expect(visibilityRequestSchema.safeParse({ state: 'temporary' }).success).toBe(false);
  });

  it('accepts a temporary pause with a return date', () => {
    expect(
      visibilityRequestSchema.safeParse({ state: 'temporary', until: RETURN_DAY }).success,
    ).toBe(true);
  });

  it('rejects an unknown state', () => {
    expect(visibilityRequestSchema.safeParse({ state: 'archived' }).success).toBe(false);
  });

  it('rejects unexpected fields so a client cannot smuggle a publish flag', () => {
    const parsed = visibilityRequestSchema.safeParse({ state: 'visible', isPublished: true });
    expect(parsed.success).toBe(false);
  });
});

describe(visibilityUpdate, () => {
  it('republishes and clears both marks when made visible', () => {
    expect(visibilityUpdate({ state: 'visible' })).toEqual({
      isPublished: true,
      hiddenUntil: null,
      hiddenReason: null,
    });
  });

  it('stores the return date for a temporary pause', () => {
    const update = visibilityUpdate({ state: 'temporary', until: RETURN_DAY });
    expect(update.hiddenUntil).toEqual(hiddenUntilDate(RETURN_DAY));
    expect(update.isPublished).toBe(false);
  });

  it('leaves no return date for an indefinite pause, so nothing restores it', () => {
    const update = visibilityUpdate({ state: 'permanent' });
    expect(update.hiddenUntil).toBeNull();
    expect(update.hiddenReason).toBe('permanent');
  });
});

describe(hiddenUntilDate, () => {
  it('keeps the entry hidden through the whole chosen day', () => {
    expect(hiddenUntilDate(RETURN_DAY).toISOString()).toBe('2026-09-15T23:59:59.999Z');
  });
});

describe(isWithinAllowedRange, () => {
  it('accepts a date inside the window', () => {
    expect(isWithinAllowedRange(RETURN_DAY, NOW)).toBe(true);
  });

  it('accepts the same day, which hides the entry until midnight', () => {
    expect(isWithinAllowedRange('2026-08-23', NOW)).toBe(true);
  });

  it('rejects a date in the past', () => {
    expect(isWithinAllowedRange('2026-08-01', NOW)).toBe(false);
  });

  it('rejects a date beyond the maximum window', () => {
    const tooFar = new Date(NOW.getTime() + (MAX_HIDDEN_DAYS + 5) * 86_400_000);
    expect(isWithinAllowedRange(tooFar.toISOString().slice(0, 10), NOW)).toBe(false);
  });
});

describe(currentVisibility, () => {
  it('reports a published entry as visible', () => {
    expect(currentVisibility({ isPublished: true })).toBe('visible');
  });

  it('reports a paused entry as temporary', () => {
    expect(currentVisibility({ isPublished: false, hiddenReason: 'temporary' })).toBe('temporary');
  });

  it('treats a legacy unpublished entry as permanently hidden', () => {
    expect(currentVisibility({ isPublished: false })).toBe('permanent');
  });
});
