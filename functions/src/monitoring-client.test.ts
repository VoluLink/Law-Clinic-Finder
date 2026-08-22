import { describe, expect, it } from 'vitest';

import { operationalPolicy } from './monitoring-client.js';

const CHANNEL = 'projects/law-clinic-finder/notificationChannels/channel-1';

describe(operationalPolicy, () => {
  it('builds a built-in Cloud Run 5xx policy without a custom log metric', () => {
    const policy = operationalPolicy('cloud_run_5xx', CHANNEL);
    const threshold = policy.conditions[0]?.conditionThreshold;

    expect(threshold?.filter).toContain('run.googleapis.com/request_count');
    expect(threshold?.filter).toContain('response_code_class="5xx"');
    expect(threshold?.thresholdValue).toBe(0);
    expect(policy.notificationChannels).toEqual([CHANNEL]);
  });

  it('alerts when active Cloud Run instances reach the configured cap of three', () => {
    const policy = operationalPolicy('cloud_run_instance_cap', CHANNEL);
    const threshold = policy.conditions[0]?.conditionThreshold;

    expect(threshold?.filter).toContain('run.googleapis.com/container/instance_count');
    expect(threshold?.thresholdValue).toBe(2);
    expect(threshold?.comparison).toBe('COMPARISON_GT');
  });
});
