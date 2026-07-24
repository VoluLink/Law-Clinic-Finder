import { describe, expect, it } from 'vitest';

import { FIELD_HELP } from './field-help';

describe('FIELD_HELP', () => {
  it('maps every present key to a non-empty trimmed explainer', () => {
    for (const [key, text] of Object.entries(FIELD_HELP)) {
      expect(text, key).toBe(text?.trim());
      expect(text?.length ?? 0, key).toBeGreaterThan(0);
    }
  });

  it('omits website, which needs no explainer', () => {
    expect(FIELD_HELP.website).toBeUndefined();
  });
});
