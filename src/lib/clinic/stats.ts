export type ClinicEventCounts = {
  recommended_count: number;
  website_click_count: number;
  email_click_count: number;
};

export type ClinicStats = {
  recommended: number;
  websiteClicks: number;
  emailClicks: number;
  totalClicks: number;
  /** Clicks (website + email) per recommendation, as a whole percent. */
  clickRatePercent: number;
};

/** Folds the counts row (or its absence) into the numbers the stats tab shows. */
export function summarizeClinicStats(counts: ClinicEventCounts | null): ClinicStats {
  const recommended = counts?.recommended_count ?? 0;
  const websiteClicks = counts?.website_click_count ?? 0;
  const emailClicks = counts?.email_click_count ?? 0;
  const totalClicks = websiteClicks + emailClicks;
  return {
    recommended,
    websiteClicks,
    emailClicks,
    totalClicks,
    clickRatePercent: recommended === 0 ? 0 : Math.round((totalClicks / recommended) * 100),
  };
}
