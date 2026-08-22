import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isSelectedOperationalRecipient } from './email-change-store';

describe(isSelectedOperationalRecipient, () => {
  it('matches only the selected admin id', () => {
    expect(isSelectedOperationalRecipient({ selectedAdminUserId: 'admin-1' }, 'admin-1')).toBe(
      true,
    );
    expect(isSelectedOperationalRecipient({ selectedAdminUserId: 'admin-2' }, 'admin-1')).toBe(
      false,
    );
  });
});
