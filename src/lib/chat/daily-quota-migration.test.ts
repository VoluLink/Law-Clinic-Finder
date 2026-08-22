import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20260815120000_add_chat_daily_quota.sql';

describe('daily chat quota migration', () => {
  it('stores one private row per browser and Berlin calendar day', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toMatch(
      /create table private\.chat_daily_quotas[\s\S]*primary key \(quota_date, device_hash\)/,
    );
    expect(sql).toContain("now() at time zone 'Europe/Berlin'");
  });

  it('atomically permits at most two session ids with eight turns each', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toMatch(/cardinality\(v_session_ids\) >= 2[\s\S]*'allowed', false/);
    expect(sql).toMatch(/v_turn_counts\[v_session_index\] >= 8[\s\S]*'allowed', false/);
    expect(sql).toContain('for update');
  });

  it('keeps the quota private and prunes yesterday after midnight', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toContain('alter table private.chat_daily_quotas enable row level security');
    expect(sql).toMatch(
      /revoke all on private\.chat_daily_quotas from public, anon, authenticated/,
    );
    expect(sql).toMatch(/delete from private\.chat_daily_quotas[\s\S]*quota_date < v_today/);
  });
});
