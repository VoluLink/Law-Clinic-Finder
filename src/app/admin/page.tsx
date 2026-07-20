import type { Metadata } from 'next';

import { Card } from '@/components/ui/Card';
import { aggregateConversationStats } from '@/lib/admin/stats';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin – Law Clinic Finder' };

const MS_PER_DAY = 86_400_000;
const STATS_WINDOW_DAYS = 30;

function statsWindowStart(): string {
  return new Date(Date.now() - STATS_WINDOW_DAYS * MS_PER_DAY).toISOString();
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const since = statsWindowStart();
  const [{ data: rows }, { count: clinicCount }, { count: publishedCount }] = await Promise.all([
    supabase
      .from('conversations')
      .select('created_at, detected_legal_area')
      .gte('created_at', since),
    supabase.from('clinics').select('*', { count: 'exact', head: true }),
    supabase.from('clinics').select('*', { count: 'exact', head: true }).eq('is_published', true),
  ]);
  const stats = aggregateConversationStats(rows ?? []);
  const maxAreaCount = stats.byLegalArea[0]?.count ?? 1;

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Übersicht</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Gespräche (${STATS_WINDOW_DAYS} Tage)`} value={stats.total} />
        <StatCard label="Law Clinics gesamt" value={clinicCount ?? 0} />
        <StatCard label="Davon veröffentlicht" value={publishedCount ?? 0} />
      </div>
      <Card className="p-6">
        <h2 className="mb-4 font-medium text-foreground">Nachgefragte Rechtsgebiete</h2>
        {stats.byLegalArea.length === 0 && (
          <p className="text-sm text-muted">Noch keine Gespräche im Zeitraum.</p>
        )}
        <ul className="flex flex-col gap-2">
          {stats.byLegalArea.slice(0, 10).map((area) => (
            <li key={area.legalArea} className="flex items-center gap-3 text-sm">
              <span className="w-48 truncate text-muted">{area.legalArea}</span>
              <span
                className="h-3 rounded bg-primary"
                style={{ width: `${(area.count / maxAreaCount) * 60}%` }}
              />
              <span className="text-foreground">{area.count}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}
