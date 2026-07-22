export type GaMetrics = { users: number; sessions: number; avgEngagementSeconds: number };

/**
 * GA4 audience metrics via the Data API. Returns null until `GA_PROPERTY_ID` and
 * a service account (`GA_SERVICE_ACCOUNT_JSON`) are set and the
 * `@google-analytics/data` client is wired in at the integration point below —
 * the dashboard then shows real numbers instead of the empty state. It never
 * returns placeholder data.
 */
export async function loadGaMetrics(): Promise<GaMetrics | null> {
  if (!process.env.GA_PROPERTY_ID || !process.env.GA_SERVICE_ACCOUNT_JSON) return null;
  // Integration point: instantiate the GA Data API client and run a report here.
  return null;
}

export function formatEngagement(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
