import { z } from 'zod';

const settingSchema = z
  .object({ selectedAdminUserId: z.string().trim().min(1).max(128) })
  .passthrough();

export type ManagedChannel = { name: string; email: string };
export type OperationalPolicyKey = 'cloud_run_5xx' | 'cloud_run_instance_cap';

export type OperationalMonitoring = {
  findManagedChannel: () => Promise<ManagedChannel | null>;
  createManagedChannel: (email: string) => Promise<ManagedChannel>;
  updateManagedChannel: (channel: ManagedChannel, email: string) => Promise<ManagedChannel>;
  ensurePolicy: (key: OperationalPolicyKey, channelName: string) => Promise<void>;
};

export type OperationalAlertDependencies = {
  resolveAdminEmail: (userId: string) => Promise<string | null>;
  monitoring: OperationalMonitoring;
};

async function ensureChannel(email: string, monitoring: OperationalMonitoring) {
  const channel = await monitoring.findManagedChannel();
  if (!channel) return monitoring.createManagedChannel(email);
  if (channel.email === email) return channel;
  return monitoring.updateManagedChannel(channel, email);
}

export async function syncOperationalAlerts(
  settingInput: unknown,
  dependencies: OperationalAlertDependencies,
): Promise<void> {
  const setting = settingSchema.parse(settingInput);
  const email = await dependencies.resolveAdminEmail(setting.selectedAdminUserId);
  if (!email) throw new Error('Selected operational-alert recipient is not an active admin');
  const channel = await ensureChannel(email, dependencies.monitoring);
  await dependencies.monitoring.ensurePolicy('cloud_run_5xx', channel.name);
  await dependencies.monitoring.ensurePolicy('cloud_run_instance_cap', channel.name);
}
