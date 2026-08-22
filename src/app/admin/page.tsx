import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MonthStepper } from '@/components/admin/MonthStepper';
import { BarChart } from '@/components/ui/BarChart';
import { MeterList } from '@/components/ui/MeterList';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { signInState } from '@/lib/admin/clinic-access';
import { clampMonthKey, currentMonthKey, formatMonthLabel } from '@/lib/admin/month-window';
import { monthWeekCountsFromDays } from '@/lib/admin/stats';
import { formatEngagement, loadGaMetrics } from '@/lib/analytics/ga-metrics';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { estimateCostUsd, formatUsd } from '@/lib/chat/usage';
import { cn } from '@/lib/cn';
import {
  loadAdminDashboard,
  type AdminMetric,
  type FirebaseDashboard,
} from '@/lib/firebase/admin-dashboard';

import { ConversationsPanel } from './ConversationsPanel';

export const metadata: Metadata = { title: 'Dashboard – Admin' };

const CONVERSATION_LIST_LIMIT = 12;
const TOP_AREAS = 5;

function fmt(value: number): string {
  return value.toLocaleString('de-DE');
}

function metricCost(metric: AdminMetric | null): number {
  return Object.values(metric?.modelUsage ?? {}).reduce(
    (sum, usage) =>
      sum +
      estimateCostUsd(usage.model, {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }),
    0,
  );
}

function topAreas(metric: AdminMetric | null) {
  const total = metric?.conversationCount ?? 0;
  return Object.values(metric?.legalAreas ?? {})
    .filter((area) => area.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, TOP_AREAS)
    .map((area) => ({
      label: area.label,
      value: fmt(area.count),
      percent: total === 0 ? 0 : (area.count / total) * 100,
    }));
}

function accessCounts(data: FirebaseDashboard) {
  const states = data.clinics.flatMap((clinic) =>
    clinic.profile ? [signInState(clinic.profile.lastSignInAt)] : [],
  );
  return {
    active: states.filter((state) => state === 'active').length,
    invited: states.filter((state) => state === 'invited').length,
  };
}

async function loadDashboard(monthParam: string | undefined) {
  const now = Date.now();
  const month = clampMonthKey(monthParam ?? currentMonthKey(now), now);
  const [firebase, ga] = await Promise.all([
    loadAdminDashboard(month, CONVERSATION_LIST_LIMIT),
    loadGaMetrics(),
  ]);
  const total = firebase.metric?.conversationCount ?? 0;
  const matched = firebase.metric?.matchedConversationCount ?? 0;
  return {
    month,
    now,
    ga,
    totalClinics: firebase.clinics.length,
    published: firebase.clinics.filter((clinic) => clinic.is_published).length,
    access: accessCounts(firebase),
    conversationTotal: total,
    costUsd: metricCost(firebase.metric),
    matchRate: total === 0 ? 0 : Math.round((matched / total) * 100),
    chart: monthWeekCountsFromDays(firebase.metric?.dayBuckets ?? {}),
    areas: topAreas(firebase.metric),
    conversations: firebase.conversations,
  };
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const data = await loadDashboard(month);
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
    { label: 'Mitglieder-Zugang aktiv', value: data.access.active, tone: 'text-success-strong' },
    { label: 'Einladung offen', value: data.access.invited, tone: 'text-warning' },
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
