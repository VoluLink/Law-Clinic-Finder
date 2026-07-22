import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BarChart } from '@/components/ui/BarChart';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { AuthError, requireRole, type Profile } from '@/lib/auth/require-role';
import { weeklyCounts } from '@/lib/admin/stats';
import { summarizeClinicStats, type ClinicEventCounts } from '@/lib/clinic/stats';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Statistiken – Law Clinic Finder' };

const CHART_WEEKS = 8;
const WINDOW_MS = CHART_WEEKS * 7 * 86_400_000;
const COUNT_COLUMNS = 'recommended_count, website_click_count, email_click_count';

function fmt(value: number): string {
  return value.toLocaleString('de-DE');
}

async function loadClinicStats(clinicId: string) {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [countsRes, recentRes] = await Promise.all([
    supabase
      .from('clinic_event_counts')
      .select(COUNT_COLUMNS)
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    supabase
      .from('clinic_events')
      .select('created_at')
      .eq('clinic_id', clinicId)
      .eq('kind', 'recommended')
      .gte('created_at', since),
  ]);
  const recommendedAt = ((recentRes.data ?? []) as { created_at: string }[]).map(
    (row) => row.created_at,
  );
  return {
    stats: summarizeClinicStats((countsRes.data as ClinicEventCounts | null) ?? null),
    chart: weeklyCounts(recommendedAt, Date.now(), CHART_WEEKS),
  };
}

export default async function ClinicStatisticsPage() {
  const supabase = await createSupabaseServerClient();
  let profile: Profile;
  try {
    profile = await requireRole(supabase, ['clinic', 'admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  if (!profile.clinic_id) return <AdminHint />;
  const data = await loadClinicStats(profile.clinic_id);
  return <StatisticsView data={data} />;
}

function StatisticsView({ data }: { data: Awaited<ReturnType<typeof loadClinicStats>> }) {
  const { stats, chart } = data;
  return (
    <div className="flex flex-col gap-[18px]">
      <p className="max-w-2xl text-sm text-muted">
        So oft hat der Finder deine Law Clinic vorgeschlagen und wie viele Ratsuchende danach auf
        deine Website oder E-Mail geklickt haben. Anonyme Zahlen, keine personenbezogenen Daten.
      </p>
      <div className="grid grid-cols-2 gap-[18px] min-[860px]:grid-cols-4">
        <StatCard
          label="Empfehlungen"
          value={fmt(stats.recommended)}
          hint="Wie oft vorgeschlagen"
        />
        <StatCard
          label="Website-Klicks"
          value={fmt(stats.websiteClicks)}
          hint="Aufrufe deiner Homepage"
        />
        <StatCard label="E-Mail-Klicks" value={fmt(stats.emailClicks)} hint="Kontakt per E-Mail" />
        <StatCard
          label="Klickrate"
          value={`${stats.clickRatePercent} %`}
          hint="Klicks je Empfehlung"
          tone="dark"
        />
      </div>
      <Panel title="Empfehlungen · letzte 8 Wochen">
        {stats.recommended > 0 ? (
          <BarChart bars={chart} />
        ) : (
          <p className="text-sm text-muted">
            Sobald deine Law Clinic vorgeschlagen wird, erscheinen hier deine Zahlen.
          </p>
        )}
      </Panel>
    </div>
  );
}

function AdminHint() {
  return (
    <p className="text-sm text-muted">
      Dieses Konto ist keiner Law Clinic zugeordnet. Statistiken gibt es nur für Law-Clinic-Konten –
      zur Verwaltung nutze den{' '}
      <Link href="/admin" className="text-primary underline">
        Admin-Bereich
      </Link>
      .
    </p>
  );
}
