import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

import type {
  ManagedChannel,
  OperationalMonitoring,
  OperationalPolicyKey,
} from './operational-alerts.js';

const PROJECT_ID = 'law-clinic-finder';
const API_BASE = 'https://monitoring.googleapis.com/v3/';
const MANAGED_LABELS = { managed_by: 'law_clinic_finder', purpose: 'operational_alerts' };
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const channelSchema = z
  .object({
    name: z.string().min(1),
    labels: z.record(z.string(), z.string()),
    userLabels: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
const channelListSchema = z.object({ notificationChannels: z.array(channelSchema).optional() });
const policySchema = z
  .object({
    name: z.string().min(1),
    userLabels: z.record(z.string(), z.string()).optional(),
    notificationChannels: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();
const policyListSchema = z.object({ alertPolicies: z.array(policySchema).optional() });

type Aggregation = {
  alignmentPeriod: string;
  perSeriesAligner: string;
  crossSeriesReducer: string;
  groupByFields: string[];
};

type MetricThreshold = {
  filter: string;
  aggregations: Aggregation[];
  comparison: 'COMPARISON_GT';
  thresholdValue: number;
  duration: string;
  trigger: { count: number };
};

export type OperationalPolicy = {
  displayName: string;
  documentation: { content: string; mimeType: 'text/markdown' };
  userLabels: { managed_by: string; alert_key: OperationalPolicyKey };
  conditions: { displayName: string; conditionThreshold: MetricThreshold }[];
  combiner: 'OR';
  enabled: boolean;
  notificationChannels: string[];
  alertStrategy: { autoClose: string; notificationPrompts: ('OPENED' | 'CLOSED')[] };
};

function aggregation(period: string, aligner: string, reducer: string): Aggregation {
  return {
    alignmentPeriod: period,
    perSeriesAligner: aligner,
    crossSeriesReducer: reducer,
    groupByFields: ['resource.label.service_name'],
  };
}

function threshold(key: OperationalPolicyKey): MetricThreshold {
  const isErrors = key === 'cloud_run_5xx';
  return {
    filter: isErrors ? errorFilter() : instanceFilter(),
    aggregations: [
      isErrors
        ? aggregation('300s', 'ALIGN_SUM', 'REDUCE_SUM')
        : aggregation('60s', 'ALIGN_MAX', 'REDUCE_SUM'),
    ],
    comparison: 'COMPARISON_GT',
    thresholdValue: isErrors ? 0 : 2,
    duration: isErrors ? '0s' : '60s',
    trigger: { count: 1 },
  };
}

function errorFilter(): string {
  return 'resource.type="cloud_run_revision" AND resource.label.service_name="web" AND metric.type="run.googleapis.com/request_count" AND metric.label.response_code_class="5xx"';
}

function instanceFilter(): string {
  return 'resource.type="cloud_run_revision" AND resource.label.service_name="web" AND metric.type="run.googleapis.com/container/instance_count" AND metric.label.state="active"';
}

export function operationalPolicy(
  key: OperationalPolicyKey,
  channelName: string,
): OperationalPolicy {
  const errors = key === 'cloud_run_5xx';
  const subject = errors ? 'Cloud Run 5xx responses' : 'Cloud Run instance cap';
  return {
    displayName: `Law Clinic Finder — ${subject}`,
    documentation: {
      content: errors
        ? 'App Hosting returned at least one 5xx response within five minutes.'
        : 'The App Hosting service reached its configured maximum of three instances.',
      mimeType: 'text/markdown',
    },
    userLabels: { managed_by: 'law_clinic_finder', alert_key: key },
    conditions: [{ displayName: subject, conditionThreshold: threshold(key) }],
    combiner: 'OR',
    enabled: true,
    notificationChannels: [channelName],
    alertStrategy: { autoClose: '1800s', notificationPrompts: ['OPENED', 'CLOSED'] },
  };
}

async function monitoringRequest<T>(
  resource: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const accessToken = await auth.getAccessToken();
  if (!accessToken) throw new Error('Monitoring access token unavailable');
  const response = await fetch(`${API_BASE}${resource}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Monitoring API request failed with ${response.status}`);
  return schema.parse((await response.json()) as unknown);
}

function managedChannel(channel: z.infer<typeof channelSchema>): boolean {
  return Object.entries(MANAGED_LABELS).every(
    ([key, value]) => channel.userLabels?.[key] === value,
  );
}

function toManagedChannel(channel: z.infer<typeof channelSchema>): ManagedChannel {
  const email = channel.labels.email_address;
  if (!email) throw new Error('Managed operational channel has no email address');
  return { name: channel.name, email: z.email().parse(email).toLowerCase() };
}

function channelPayload(email: string) {
  return {
    type: 'email',
    displayName: 'Law Clinic Finder — operational alerts',
    description: 'Admin-selected recipient for managed operational alerts.',
    labels: { email_address: z.email().parse(email).toLowerCase() },
    userLabels: MANAGED_LABELS,
    enabled: true,
  };
}

export class GoogleMonitoringClient implements OperationalMonitoring {
  private policies: Promise<z.infer<typeof policySchema>[]> | null = null;

  async findManagedChannel(): Promise<ManagedChannel | null> {
    const result = await monitoringRequest(
      `projects/${PROJECT_ID}/notificationChannels?pageSize=100`,
      { method: 'GET' },
      channelListSchema,
    );
    const channel = result.notificationChannels?.find(managedChannel);
    return channel ? toManagedChannel(channel) : null;
  }

  async createManagedChannel(email: string): Promise<ManagedChannel> {
    const channel = await monitoringRequest(
      `projects/${PROJECT_ID}/notificationChannels`,
      { method: 'POST', body: JSON.stringify(channelPayload(email)) },
      channelSchema,
    );
    return toManagedChannel(channel);
  }

  async updateManagedChannel(channel: ManagedChannel, email: string): Promise<ManagedChannel> {
    const mask = 'displayName,description,labels,userLabels,enabled';
    const updated = await monitoringRequest(
      `${channel.name}?updateMask=${mask}`,
      { method: 'PATCH', body: JSON.stringify({ name: channel.name, ...channelPayload(email) }) },
      channelSchema,
    );
    return toManagedChannel(updated);
  }

  async ensurePolicy(key: OperationalPolicyKey, channelName: string): Promise<void> {
    const policies = await this.listPolicies();
    const existing = policies.find((policy) => policy.userLabels?.alert_key === key);
    if (!existing) return this.createPolicy(key, channelName);
    if (existing.enabled !== false && existing.notificationChannels?.[0] === channelName) return;
    await monitoringRequest(
      `${existing.name}?updateMask=notificationChannels,enabled`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: existing.name,
          notificationChannels: [channelName],
          enabled: true,
        }),
      },
      policySchema,
    );
  }

  private async listPolicies() {
    this.policies ??= monitoringRequest(
      `projects/${PROJECT_ID}/alertPolicies?pageSize=100`,
      { method: 'GET' },
      policyListSchema,
    ).then((result) =>
      (result.alertPolicies ?? []).filter(
        (policy) => policy.userLabels?.managed_by === 'law_clinic_finder',
      ),
    );
    return this.policies;
  }

  private async createPolicy(key: OperationalPolicyKey, channelName: string): Promise<void> {
    const created = await monitoringRequest(
      `projects/${PROJECT_ID}/alertPolicies`,
      { method: 'POST', body: JSON.stringify(operationalPolicy(key, channelName)) },
      policySchema,
    );
    (await this.listPolicies()).push(created);
  }
}
