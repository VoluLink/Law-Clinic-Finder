import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BarChart } from '@/components/ui/BarChart';
import { MeterList } from '@/components/ui/MeterList';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { MonthStepper } from '@/components/admin/MonthStepper';
import { deriveAccessState, loadLastSignInMap } from '@/lib/admin/clinic-access';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import {
  clampMonthKey,
  currentMonthKey,
  formatMonthLabel,
  monthRange,
} from '@/lib/admin/month-window';
import { aggregateConversationStats, matchRate, monthWeekCounts } from '@/lib/admin/stats';
import { formatEngagement, loadGaMetrics } from '@/lib/analytics/ga-metrics';
import { estimateCostUsd, formatUsd } from '@/lib/chat/usage';
import { cn } from '@/lib/cn';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ConversationsPanel, type ConversationRow } from './ConversationsPanel';

export const metadata: Metadata = { title: 'Dashboard – Admin' };

const CONV_LIST_LIMIT = 12;
const TOP_AREAS = 5;
const CONV_LIST_COLUMNS =
  'id, created_at, redacted_transcript, redaction_status, detected_legal_area, ' +
  'detected_city, matched_clinic_count, message_count, model';

type ClinicAccessRow = {
  is_published: boolean;
  contact_email: string | null;
  profiles: { user_id: string }[] | { user_id: string } | null;
};
type WindowRow = {
  created_at: string;
  detected_legal_area: string | null;
  matched_clinic_count: number | null;
};
type CostRow = { input_tokens: number; output_tokens: number; model: string };

function sumCostUsd(rows: CostRow[]): number {
  return rows.reduce(
    (sum, row) =>
      sum +
      estimateCostUsd(row.model, {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
      }),
    0,
  );
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE');
}

async function loadDashboard(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  monthParam: string | undefined,
) {
  const now = Date.now();
  const month = clampMonthKey(monthParam ?? currentMonthKey(now), now);
  const { startIso, endIso } = monthRange(month);
  const [clinicsRes, monthRows, monthCount, listRes, costRes] = await Promise.all([
    admin.from('clinics').select('is_published, contact_email, profiles(user_id)'),
    // Chat-derived widgets are scoped to the selected month; the stepper pages
    // through the retained 12-month window.
    admin
      .from('conversations')
      .select('created_at, detected_legal_area, matched_clinic_count')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    admin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    // The "Anonymisierte Gespräche" list stays newest-first (not month-scoped) and
    // always sits inside the newest-200 transcript cap, so it always has a verlauf.
    admin
      .from('conversations')
      .select(CONV_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(CONV_LIST_LIMIT),
    admin
      .from('conversations')
      .select('input_tokens, output_tokens, model')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
  ]);

  const lastSignIn = await loadLastSignInMap(admin).catch(() => new Map<string, string | null>());

  const clinics = (clinicsRes.data ?? []) as unknown as ClinicAccessRow[];
  const windowRows = (monthRows.data ?? []) as unknown as WindowRow[];
  const access = clinics.map((clinic) => deriveAccessState(clinic, lastSignIn));

  return {
    month,
    now,
    totalClinics: clinics.length,
    published: clinics.filter((clinic) => clinic.is_published).length,
    accessActive: access.filter((state) => state === 'active').length,
    accessInvited: access.filter((state) => state === 'invited').length,
    conversationTotal: monthCount.count ?? 0,
    costUsd: sumCostUsd((costRes.data ?? []) as unknown as CostRow[]),
    ga: await loadGaMetrics(),
    matchRate: matchRate(windowRows),
    chart: monthWeekCounts(windowRows.map((row) => row.created_at)),
    areas: topAreas(windowRows),
    conversations: (listRes.data ?? []) as unknown as ConversationRow[],
  };
}

function topAreas(rows: WindowRow[]) {
  const { byLegalArea } = aggregateConversationStats(rows);
  return byLegalArea.slice(0, TOP_AREAS).map((area) => ({
    label: area.legalArea,
    value: fmt(area.count),
    percent: rows.length === 0 ? 0 : (area.count / rows.length) * 100,
  }));
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const data = await loadDashboard(createSupabaseAdminClient(), month);
  const monthLabel = formatMonthLabel(data.month);
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-[18px] min-[860px]:grid-cols-3">
        <StatCard
          label="Nutzer"
          value={data.ga ? fmt(data.ga.users) : '—'}
          hint="Google Analytics"
        />
        <StatCard
          label="Sitzungen"
          value={data.ga ? fmt(data.ga.sessions) : '—'}
          hint="Google Analytics"
        />
        <StatCard
          label="Ø Engagement-Zeit"
          value={data.ga ? formatEngagement(data.ga.avgEngagementSeconds) : '—'}
          hint="Google Analytics"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-primary">KI-Statistiken · {monthLabel}</h2>
        <MonthStepper month={data.month} now={data.now} />
      </div>

      <div className="grid grid-cols-2 gap-[18px] min-[860px]:grid-cols-3">
        <StatCard
          label="KI-Interaktionen"
          value={fmt(data.conversationTotal)}
          hint="Abgeschlossene Chat-Suchen"
        />
        <StatCard
          label="API-Kosten (LLM)"
          value={formatUsd(data.costUsd)}
          hint={`Ø ${formatUsd(
            data.conversationTotal > 0 ? data.costUsd / data.conversationTotal : 0,
          )} / Interaktion`}
          tone="dark"
        />
        <StatCard
          label="Vermittlungsquote"
          value={`${data.matchRate} %`}
          hint="mit passendem Treffer"
        />
      </div>

      <div className="grid gap-[18px] min-[860px]:grid-cols-[1.5fr_1fr]">
        <Panel title={`KI-Interaktionen · ${monthLabel}`}>
          <BarChart bars={data.chart} />
        </Panel>
        <Panel title="Nachgefragte Rechtsgebiete">
          {data.areas.length > 0 ? (
            <MeterList rows={data.areas} />
          ) : (
            <p className="text-sm text-muted">Noch keine Daten.</p>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-[18px] min-[860px]:grid-cols-2">
        <Panel title="Datenbank auf einen Blick">
          <DbGlance data={data} />
        </Panel>
        <Panel title="Anonymisierte Gespräche">
          <p className="mb-4 text-sm text-muted">Pseudonymisierte KI-Suchverläufe.</p>
          <ConversationsPanel conversations={data.conversations} />
        </Panel>
      </div>
    </div>
  );
}

function DbGlance({ data }: { data: Awaited<ReturnType<typeof loadDashboard>> }) {
  const rows = [
    { label: 'Law Clinics gesamt', value: data.totalClinics, tone: 'text-primary' },
    { label: 'Veröffentlicht', value: data.published, tone: 'text-primary' },
    {
      label: 'Nicht veröffentlicht',
      value: data.totalClinics - data.published,
      tone: 'text-primary',
    },
    { label: 'Mitglieder-Zugang aktiv', value: data.accessActive, tone: 'text-success-strong' },
    { label: 'Einladung offen', value: data.accessInvited, tone: 'text-warning' },
  ];
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={cn(
            'flex items-center justify-between py-3.5',
            index < rows.length - 1 && 'border-b border-border',
          )}
        >
          <span className="text-sm text-foreground">{row.label}</span>
          <span className={cn('text-xl font-extrabold', row.tone)}>{fmt(row.value)}</span>
        </div>
      ))}
    </div>
  );
}
