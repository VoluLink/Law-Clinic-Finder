import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins class strings with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});
