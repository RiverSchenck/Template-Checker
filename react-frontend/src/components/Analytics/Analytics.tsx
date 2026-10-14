import React, { useCallback, useMemo, useState } from 'react';
import { Activity, BarChart3, Inbox, ListChecks, PlugZap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../AuthContext';
import { Skeleton } from '../ui/skeleton';
import { TooltipProvider } from '../ui/tooltip';
import { EmptyState, PageHeader, PageShell, StatusPill } from '../layout/page-kit';
import { useApiUsage, useOverview } from './useAnalytics';
import { periodSearch, useAnalyticsUrlState, writeFilters } from './urlState';
import { PeriodPicker } from './PeriodBar';
import { Highlights } from './Highlights';
import { KpiTiles } from './KpiTiles';
import { UsageChart } from './UsageChart';
import { TopIssues } from './TopIssues';
import { IssueSheet } from './IssueSheet';
import { Categories } from './Categories';
import { Reliability } from './Reliability';
import { Team } from './Team';
import { RunsTable } from './RunsTable';
import { RunSheet } from './RunSheet';
import { ApiUsage } from './ApiUsage';
import { ErrorNote } from './parts';
import { personLabel } from './format';
import type { Overview, PeriodSelection, RunFilters, RunRow } from './types';

/** A card outline with placeholder content, so loading looks like the page instead of grey slabs. */
function SkeletonCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col rounded-xl border bg-card p-5', className)}>{children}</div>;
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="mt-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className={cn('h-3.5 rounded', ['w-48', 'w-36', 'w-44', 'w-28', 'w-40', 'w-32'][i % 6])} />
          <Skeleton className="ml-auto h-3.5 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsLoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <Skeleton className="h-4 w-80 max-w-full rounded" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-[178px]">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-3 h-7 w-20 rounded" />
            <Skeleton className="mt-2 h-3 w-28 rounded" />
            <Skeleton className="mt-auto h-10 w-full rounded" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="h-[360px]">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full rounded" />
        <Skeleton className="mt-6 w-full flex-1 rounded-lg" />
      </SkeletonCard>
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2">
          <Skeleton className="h-4 w-28 rounded" />
          <ListSkeleton rows={6} />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-4 w-24 rounded" />
          <ListSkeleton rows={6} />
        </SkeletonCard>
      </div>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3 mt-10">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
    </div>
  );
}

/** The analytics pages, by path under /analytics. Admin pages are also guarded in App.tsx; the backend enforces it too. */
export const ANALYTICS_PAGES: Record<string, { title: string; description: string; icon: LucideIcon; admin?: boolean }> = {
  '': {
    title: 'Analytics',
    description: "How support uses the template checker, and what customers' templates get wrong.",
    icon: BarChart3,
  },
  operations: {
    title: 'Operations',
    description: "How the checker is holding up, and who's using it.",
    icon: Activity,
    admin: true,
  },
  checks: {
    title: 'All checks',
    description: 'Every check in this period, newest first. Select one for details.',
    icon: ListChecks,
    admin: true,
  },
  api: {
    title: 'API usage',
    description: 'Who calls the API with a key, which endpoints, and what goes wrong.',
    icon: PlugZap,
    admin: true,
  },
};

export function analyticsPageKey(pathname: string): string {
  return pathname.replace(/^\/analytics\/?/, '').split('/')[0];
}

type AnalyticsContext = {
  overview: Overview;
  period: PeriodSelection;
  filters: RunFilters;
  setFilters: (f: RunFilters) => void;
  chipLabels: { issue?: string; agent?: string };
  refresh: number;
  setIssue: (validationType: string | null) => void;
  selectRun: (run: RunRow) => void;
  /** Open All checks with these filters (admins only). */
  showRuns: (change: Partial<RunFilters>) => void;
};

const useAnalytics = () => useOutletContext<AnalyticsContext>();

/** Header, period and the overview shared by every analytics page; the page itself renders in the outlet. */
export function AnalyticsLayout() {
  const { params, period, setPeriod, filters, setFilters, issue: issueParam, setIssue } = useAnalyticsUrlState();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const page = ANALYTICS_PAGES[analyticsPageKey(pathname)] ?? ANALYTICS_PAGES[''];
  const [refresh, setRefresh] = useState(0);
  const { data: overview, loading, error } = useOverview(period, refresh);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);

  const selectedIssue = useMemo(
    () => overview?.issues.find((i) => i.validation_type === issueParam) ?? null,
    [overview, issueParam]
  );
  const chipLabels = useMemo(
    () => ({
      issue: overview?.issues.find((i) => i.validation_type === filters.validationType)?.label,
      agent: (() => {
        const user = overview?.users.find((u) => u.user_id === filters.userId);
        return user ? personLabel(user.display_name, user.email) : undefined;
      })(),
    }),
    [overview, filters.validationType, filters.userId]
  );

  const showRuns = useCallback(
    (change: Partial<RunFilters>) => {
      const next = new URLSearchParams(periodSearch(params));
      writeFilters(next, { ...filters, ...change });
      const search = next.toString();
      navigate(`/analytics/checks${search ? `?${search}` : ''}`);
    },
    [params, filters, navigate]
  );

  const isEmpty = overview && overview.current.runs === 0 && overview.previous.runs === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell className="max-w-6xl">
        <PageHeader
          icon={page.icon}
          title={page.title}
          badge={page.admin ? <StatusPill>Admin only</StatusPill> : undefined}
          description={page.description}
          actions={<PeriodPicker period={period} onChange={setPeriod} />}
        />

        {error && !overview && <ErrorNote message={error} onRetry={() => setRefresh((r) => r + 1)} />}
        {!overview && !error && <AnalyticsLoadingState />}

        {overview && (
          <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            {error && (
              <div className="mb-4">
                <ErrorNote message={`Couldn't refresh: ${error}`} onRetry={() => setRefresh((r) => r + 1)} />
              </div>
            )}

            {isEmpty ? (
              <div className="rounded-xl border bg-card">
                <EmptyState
                  icon={Inbox}
                  title="No checks in this period"
                  description="Nobody ran the checker in these dates. Try a longer range."
                />
              </div>
            ) : (
              <Outlet
                context={
                  {
                    overview,
                    period,
                    filters,
                    setFilters,
                    chipLabels,
                    refresh,
                    setIssue,
                    selectRun: setSelectedRun,
                    showRuns,
                  } satisfies AnalyticsContext
                }
              />
            )}

            <IssueSheet
              issue={selectedIssue}
              overview={overview}
              period={period}
              refresh={refresh}
              onClose={() => setIssue(null)}
              onShowRuns={
                isAdmin ? (issue) => showRuns({ validationType: issue.validation_type, status: undefined }) : undefined
              }
            />
            <RunSheet
              run={selectedRun}
              onClose={() => setSelectedRun(null)}
              onFilterTemplate={(run) => {
                setSelectedRun(null);
                showRuns({ search: run.template_name, status: undefined, source: undefined, userId: undefined, validationType: undefined });
              }}
              onFilterAgent={(run) => {
                setSelectedRun(null);
                showRuns({ userId: run.user_id ?? undefined });
              }}
            />
          </div>
        )}
      </PageShell>
    </TooltipProvider>
  );
}

/** What's worth a look, usage and findings. Everyone sees this page. */
export function AnalyticsOverview() {
  const { overview, setIssue, showRuns } = useAnalytics();
  const { isAdmin } = useAuth();
  return (
    <>
      <Highlights
        overview={overview}
        onSelectIssue={(i) => setIssue(i.validation_type)}
        onShowFailures={isAdmin ? () => showRuns({ status: 'failed' }) : undefined}
      />

      <KpiTiles overview={overview} />

      <div className="mt-6">
        <UsageChart overview={overview} />
      </div>

      <SectionHeading title="Findings" description="Which checks fire, how often, and whether that's changing" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <TopIssues overview={overview} onSelect={(i) => setIssue(i.validation_type)} />
        </div>
        <Categories overview={overview} />
      </div>
    </>
  );
}

/** Reliability and who's using the checker (admin only). */
export function AnalyticsOperations() {
  const { overview, selectRun, showRuns } = useAnalytics();
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">
        <Reliability overview={overview} onSelectRun={selectRun} />
      </div>
      <div className="min-w-0 lg:col-span-2">
        <Team overview={overview} onSelect={(user) => showRuns({ userId: user.user_id ?? undefined })} />
      </div>
    </div>
  );
}

/** Every check in the period (admin only). */
export function AnalyticsChecks() {
  const { period, filters, setFilters, chipLabels, refresh, selectRun } = useAnalytics();
  return (
    <RunsTable
      period={period}
      filters={filters}
      onFiltersChange={setFilters}
      labels={chipLabels}
      refresh={refresh}
      onSelectRun={selectRun}
    />
  );
}

/** Requests made with API keys (admin only). */
export function AnalyticsApi() {
  const { overview, period, refresh } = useAnalytics();
  const [retry, setRetry] = useState(0);
  const { data, loading, error } = useApiUsage(period, refresh + retry);
  return (
    <div className={cn('transition-opacity', loading && data && 'opacity-60')} aria-busy={loading}>
      {!data && loading ? (
        <AnalyticsLoadingState />
      ) : (
        <ApiUsage usage={data} overview={overview} error={error} onRetry={() => setRetry((r) => r + 1)} />
      )}
    </div>
  );
}
