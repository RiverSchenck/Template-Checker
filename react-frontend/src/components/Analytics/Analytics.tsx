import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BarChart3, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';
import { TooltipProvider } from '../ui/tooltip';
import { EmptyState, PageHeader, PageShell } from '../layout/page-kit';
import { useOverview } from './useAnalytics';
import { useAnalyticsUrlState } from './urlState';
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
import { ErrorNote } from './parts';
import { personLabel } from './format';
import type { RunFilters, RunRow } from './types';

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <Skeleton className="h-5 w-80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[178px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[420px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[420px] rounded-xl" />
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

export function Analytics() {
  const { period, setPeriod, filters, setFilters, issue: issueParam, setIssue } = useAnalyticsUrlState();
  const [refresh, setRefresh] = useState(0);
  const { data: overview, loading, error } = useOverview(period, refresh);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const runsRef = useRef<HTMLDivElement>(null);

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
      setFilters({ ...filters, ...change });
      requestAnimationFrame(() => runsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    },
    [filters, setFilters]
  );

  const isEmpty = overview && overview.current.runs === 0 && overview.previous.runs === 0;

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell className="max-w-6xl">
        <PageHeader
          icon={BarChart3}
          title="Analytics"
          description="How support uses the template checker, and what customers' templates get wrong."
          actions={<PeriodPicker period={period} onChange={setPeriod} />}
        />

        {error && !overview && <ErrorNote message={error} onRetry={() => setRefresh((r) => r + 1)} />}
        {!overview && !error && <LoadingState />}

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
              <>
                <Highlights
                  overview={overview}
                  onSelectIssue={(i) => setIssue(i.validation_type)}
                  onShowFailures={() => showRuns({ status: 'failed' })}
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

                <SectionHeading title="Operations" description="How the checker is holding up, and who's using it" />
                <div className="grid gap-6 lg:grid-cols-5">
                  <div className="min-w-0 lg:col-span-3">
                    <Reliability overview={overview} onSelectRun={setSelectedRun} />
                  </div>
                  <div className="min-w-0 lg:col-span-2">
                    <Team overview={overview} onSelect={(user) => showRuns({ userId: user.user_id ?? undefined })} />
                  </div>
                </div>
              </>
            )}

            <div ref={runsRef} className="scroll-mt-6">
              <SectionHeading title="All checks" description="Every check in this period, newest first. Select one for details." />
              <RunsTable
                period={period}
                filters={filters}
                onFiltersChange={setFilters}
                labels={chipLabels}
                refresh={refresh}
                onSelectRun={setSelectedRun}
              />
            </div>

            <IssueSheet
              issue={selectedIssue}
              overview={overview}
              period={period}
              refresh={refresh}
              onClose={() => setIssue(null)}
              onShowRuns={(issue) => {
                setIssue(null);
                showRuns({ validationType: issue.validation_type, status: undefined });
              }}
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

export default Analytics;
