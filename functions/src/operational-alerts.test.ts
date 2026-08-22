import { describe, expect, it, vi } from 'vitest';

import { syncOperationalAlerts, type OperationalAlertDependencies } from './operational-alerts.js';

function dependencies(): OperationalAlertDependencies {
  return {
    resolveAdminEmail: vi.fn().mockResolvedValue('admin@example.org'),
    monitoring: {
      findManagedChannel: vi.fn().mockResolvedValue(null),
      createManagedChannel: vi.fn().mockResolvedValue({
        name: 'projects/law-clinic-finder/notificationChannels/channel-1',
        email: 'admin@example.org',
      }),
      updateManagedChannel: vi.fn(),
      ensurePolicy: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe(syncOperationalAlerts, () => {
  it('creates a managed channel and attaches both low-cost policies', async () => {
    const deps = dependencies();
    await syncOperationalAlerts({ selectedAdminUserId: 'admin-1' }, deps);

    expect(deps.monitoring.createManagedChannel).toHaveBeenCalledWith('admin@example.org');
    expect(deps.monitoring.ensurePolicy).toHaveBeenNthCalledWith(
      1,
      'cloud_run_5xx',
      expect.stringContaining('channel-1'),
    );
    expect(deps.monitoring.ensurePolicy).toHaveBeenNthCalledWith(
      2,
      'cloud_run_instance_cap',
      expect.stringContaining('channel-1'),
    );
  });

  it('updates the managed channel when the selected admin changes', async () => {
    const deps = dependencies();
    vi.mocked(deps.monitoring.findManagedChannel).mockResolvedValue({
      name: 'projects/law-clinic-finder/notificationChannels/channel-1',
      email: 'old@example.org',
    });
    vi.mocked(deps.monitoring.updateManagedChannel).mockResolvedValue({
      name: 'projects/law-clinic-finder/notificationChannels/channel-1',
      email: 'admin@example.org',
    });

    await syncOperationalAlerts({ selectedAdminUserId: 'admin-1' }, deps);
    expect(deps.monitoring.updateManagedChannel).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'old@example.org' }),
      'admin@example.org',
    );
  });

  it('rejects a user who is no longer an admin', async () => {
    const deps = dependencies();
    vi.mocked(deps.resolveAdminEmail).mockResolvedValue(null);

    await expect(syncOperationalAlerts({ selectedAdminUserId: 'admin-1' }, deps)).rejects.toThrow(
      'Selected operational-alert recipient is not an active admin',
    );
  });

  it('validates the Firestore event payload before cloud access', async () => {
    const deps = dependencies();
    await expect(syncOperationalAlerts({ selectedAdminUserId: '' }, deps)).rejects.toThrow();
    expect(deps.resolveAdminEmail).not.toHaveBeenCalled();
  });
});
