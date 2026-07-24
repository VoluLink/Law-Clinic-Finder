import { describe, expect, it } from 'vitest';

import {
  canGoNext,
  canGoPrev,
  clampMonthKey,
  currentMonthKey,
  formatMonthLabel,
  monthRange,
  oldestRetainedMonthKey,
  parseMonthKey,
  stepMonth,
} from './month-window';

// The user's reference scenario: standing in October 2027, statistics reach back
// to October 2026 but no further — September 2026 has rolled out of the window.
const OCT_2027 = Date.UTC(2027, 9, 15, 12, 0, 0);

describe(parseMonthKey, () => {
  it('parses a well-formed key', () => {
    expect(parseMonthKey('2026-10')).toEqual({ year: 2026, month: 10 });
  });

  it('rejects an out-of-range month', () => {
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('2026-00')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseMonthKey('nope')).toBeNull();
    expect(parseMonthKey('2026-9')).toBeNull();
  });
});

describe(currentMonthKey, () => {
  it('takes the UTC month of the instant', () => {
    expect(currentMonthKey(OCT_2027)).toBe('2027-10');
  });
});

describe(stepMonth, () => {
  it('steps back within a year', () => {
    expect(stepMonth('2026-10', -1)).toBe('2026-09');
  });

  it('rolls across the year boundary in both directions', () => {
    expect(stepMonth('2026-01', -1)).toBe('2025-12');
    expect(stepMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe(oldestRetainedMonthKey, () => {
  it('is exactly twelve months before the current month', () => {
    expect(oldestRetainedMonthKey(OCT_2027)).toBe('2026-10');
  });
});

describe(monthRange, () => {
  it('spans the first of the month to the first of the next', () => {
    expect(monthRange('2026-10')).toEqual({
      startIso: '2026-10-01T00:00:00.000Z',
      endIso: '2026-11-01T00:00:00.000Z',
    });
  });

  it('rolls the end into the next year in December', () => {
    expect(monthRange('2026-12').endIso).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe(canGoPrev, () => {
  it('is false at the oldest retained month', () => {
    expect(canGoPrev('2026-10', OCT_2027)).toBe(false);
  });

  it('is true above the retention floor', () => {
    expect(canGoPrev('2026-11', OCT_2027)).toBe(true);
  });
});

describe(canGoNext, () => {
  it('is false in the current month', () => {
    expect(canGoNext('2027-10', OCT_2027)).toBe(false);
  });

  it('is true for any past month', () => {
    expect(canGoNext('2027-09', OCT_2027)).toBe(true);
  });
});

describe(clampMonthKey, () => {
  it('keeps an in-range month untouched', () => {
    expect(clampMonthKey('2027-03', OCT_2027)).toBe('2027-03');
  });

  it('pulls a future month back to the current one', () => {
    expect(clampMonthKey('2028-01', OCT_2027)).toBe('2027-10');
  });

  it('pulls an expired month up to the retention floor', () => {
    expect(clampMonthKey('2026-09', OCT_2027)).toBe('2026-10');
  });

  it('falls back to the current month for invalid input', () => {
    expect(clampMonthKey('garbage', OCT_2027)).toBe('2027-10');
  });
});

describe(formatMonthLabel, () => {
  it('renders a German long month and year', () => {
    expect(formatMonthLabel('2026-10')).toBe('Oktober 2026');
  });

  it('echoes invalid keys unchanged', () => {
    expect(formatMonthLabel('nope')).toBe('nope');
  });
});
