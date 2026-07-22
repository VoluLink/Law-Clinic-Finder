import { describe, expect, it } from 'vitest';

import { summarizeClinicStats } from './stats';

describe(summarizeClinicStats, () => {
  it('reports zeros for a clinic with no events yet', () => {
    expect(summarizeClinicStats(null)).toEqual({
      recommended: 0,
      websiteClicks: 0,
      emailClicks: 0,
      totalClicks: 0,
      clickRatePercent: 0,
    });
  });

  it('sums website and email clicks into the total', () => {
    const stats = summarizeClinicStats({
      recommended_count: 10,
      website_click_count: 3,
      email_click_count: 1,
    });
    expect(stats.totalClicks).toBe(4);
  });

  it('expresses the click rate as clicks per recommendation in percent', () => {
    const stats = summarizeClinicStats({
      recommended_count: 10,
      website_click_count: 3,
      email_click_count: 1,
    });
    expect(stats.clickRatePercent).toBe(40);
  });

  it('avoids dividing by zero when nothing was recommended', () => {
    const stats = summarizeClinicStats({
      recommended_count: 0,
      website_click_count: 2,
      email_click_count: 0,
    });
    expect(stats.clickRatePercent).toBe(0);
  });
});
