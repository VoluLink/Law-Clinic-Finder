import { describe, expect, it } from 'vitest';

import { isActiveOperationalAlertAdmin } from './operational-alert-store';

describe(isActiveOperationalAlertAdmin, () => {
  it('accepts only an active admin profile', () => {
    expect(isActiveOperationalAlertAdmin({ role: 'admin', accessStatus: 'active' })).toBe(true);
    expect(isActiveOperationalAlertAdmin({ role: 'admin', accessStatus: 'pending' })).toBe(false);
    expect(isActiveOperationalAlertAdmin({ role: 'clinic', accessStatus: 'active' })).toBe(false);
  });
});
