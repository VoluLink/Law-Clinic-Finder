import { describe, expect, it } from 'vitest';

import { rejectAccountCreation } from './index.js';

describe(rejectAccountCreation.name, () => {
  it('rejects every end-user account creation attempt', () => {
    expect(() => rejectAccountCreation()).toThrow(
      expect.objectContaining({ code: 'permission-denied' }),
    );
  });
});
