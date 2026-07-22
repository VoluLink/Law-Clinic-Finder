import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';

import { BarChart } from '@/components/ui/BarChart';
import { MeterList } from '@/components/ui/MeterList';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { deriveAccessState, loadLastSignInMap } from '@/lib/admin/clinic-access';
import { aggregateConversationStats, matchRate, weeklyCounts } from '@/lib/admin/stats';
import { formatEngagement, loadGaMetrics } from '@/lib/analytics/ga-metrics';
import { estimateCostUsd, formatUsd } from '@/lib/chat/usage';
import { cn } from '@/lib/cn';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ConversationsPanel, type ConversationRow } from './ConversationsPanel';

export const metadata: Metadata = { title: 'Dashboard – Admin' };

const CHART_WEEKS = 8;
const WINDOW_MS = CHART_WEEKS * 7 * 86_400_000;
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

function adminClientOrNull(): SupabaseClient | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function loadDashboard() {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [clinicsRes, windowRes, totalConv, listRes, costRes] = await Promise.all([
    supabase.from('clinics').select('is_published, contact_email, profiles(user_id)'),
    supabase
      .from('conversations')
      .select('created_at, detected_legal_area, matched_clinic_count')
      .gte('created_at', since),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase
      .from('conversations')
      .select(CONV_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(CONV_LIST_LIMIT),
    // All-time token rows (3 small columns) — summed in app for total LLM spend.
    supabase.from('conversations').select('input_tokens, output_tokens, model'),
  ]);

  const admin = adminClientOrNull();
  const lastSignIn = admin
    ? await loadLastSignInMap(admin).catch(() => new Map<string, string | null>())
    : new Map<string, string | null>();

  const clinics = (clinicsRes.data ?? []) as unknown as ClinicAccessRow[];
  const windowRows = (windowRes.data ?? []) as unknown as WindowRow[];
  const access = clinics.map((clinic) => deriveAccessState(clinic, lastSignIn));

  return {
    totalClinics: clinics.length,
    published: clinics.filter((clinic) => clinic.is_published).length,
    accessActive: access.filter((state) => state === 'active').length,
    accessInvited: access.filter((state) => state === 'invited').length,
    conversationTotal: totalConv.count ?? 0,
    costUsd: sumCostUsd((costRes.data ?? []) as unknown as CostRow[]),
    ga: await loadGaMetrics(),
    matchRate: matchRate(windowRows),
    chart: weeklyCounts(
      windowRows.map((row) => row.created_at),
      Date.now(),
      CHART_WEEKS,
    ),
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

export default async function AdminDashboardPage() {
  const data = await loadDashboard();
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
        <Panel title="KI-Interaktionen · letzte 8 Wochen">
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
