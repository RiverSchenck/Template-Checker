import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronRight, Info, SearchCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState, Segmented, StatusPill } from '../layout/page-kit';
import { Meter, SectionCard } from './parts';
import { categoryLabel, formatCount, formatPercent, hasFullPreviousPeriod, ratio } from './format';
import type { IssueSummary, Overview, Severity } from './types';

type SeverityFilter = 'all' | Severity;

export const SEVERITY: Record<Severity, { icon: LucideIcon; label: string; className: string }> = {
  error: { icon: AlertCircle, label: 'Blocker', className: 'text-rose-600 dark:text-rose-400' },
  warning: { icon: AlertTriangle, label: 'Warning', className: 'text-amber-600 dark:text-amber-400' },
  info: { icon: Info, label: 'Info', className: 'text-sky-600 dark:text-sky-400' },
};

const COLLAPSED_COUNT = 8;

/** First seen this period, and we were already collecting data before it (otherwise everything looks new). */
export function isNewIssue(issue: IssueSummary, overview: Overview): boolean {
  const periodStart = new Date(overview.period.start).getTime();
  if (!overview.data_since || new Date(overview.data_since).getTime() >= periodStart) return false;
  return new Date(issue.first_seen_at).getTime() >= periodStart;
}

/** Change in the share of checks affected, in percentage points; null when there's nothing to compare. */
export function shareChange(issue: IssueSummary, overview: Overview): number | null {
  if (!hasFullPreviousPeriod(overview)) return null;
  const now = ratio(issue.runs_affected, overview.current.completed);
  const before = ratio(issue.prev_runs_affected, overview.previous.completed);
  if (now == null || before == null) return null;
  return now - before;
}

function ShareChange({ change, isNew }: { change: number | null; isNew: boolean }) {
  if (isNew) return <StatusPill tone="violet">New</StatusPill>;
  if (change == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pts = change * 100;
  if (Math.abs(pts) < 0.5) return <span className="text-xs text-muted-foreground">Steady</span>;
  // More checks hitting an issue is worse.
  return (
    <span
      className={cn(
        'text-xs font-medium tabular-nums',
        pts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      {pts > 0 ? '+' : '−'}
      {Math.abs(pts).toFixed(pts > -10 && pts < 10 ? 1 : 0)} pts
    </span>
  );
}

export function TopIssues({ overview, onSelect }: { overview: Overview; onSelect: (issue: IssueSummary) => void }) {
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const completed = overview.current.completed;

  const counts = useMemo(() => {
    const c: Record<SeverityFilter, number> = { all: overview.issues.length, error: 0, warning: 0, info: 0 };
    overview.issues.forEach((i) => (c[i.severity] += 1));
    return c;
  }, [overview.issues]);

  const issues = overview.issues.filter((i) => severity === 'all' || i.severity === severity);
  const visible = expanded ? issues : issues.slice(0, COLLAPSED_COUNT);
  const maxShare = Math.max(...issues.map((i) => ratio(i.runs_affected, completed) ?? 0), 0.0001);

  return (
    <SectionCard
      title="What templates get wrong"
      description={`Share of the ${formatCount(completed)} completed checks that hit each issue`}
      info={
        <>
          A check counts once per issue, however many times the issue shows up in it (that total is &ldquo;found&rdquo;).
          Change is in percentage points vs the previous period. <strong>New</strong> means first seen in this period.
          Select an issue for its trend and details.
        </>
      }
      action={
        <Segmented<SeverityFilter>
          ariaLabel="Severity"
          value={severity}
          onChange={(v) => {
            setSeverity(v);
            setExpanded(false);
          }}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'error', label: 'Blockers', count: counts.error },
            { value: 'warning', label: 'Warnings', count: counts.warning },
          ]}
        />
      }
      bodyClassName="px-0 pb-2"
    >
      {issues.length === 0 ? (
        <EmptyState icon={SearchCheck} title="No issues found" description="No completed check found an issue of this kind." />
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-x-4 border-y bg-neutral-50/70 px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-neutral-900/40 sm:grid-cols-[minmax(0,1fr)_minmax(120px,200px)_72px_16px]">
            <span>Issue</span>
            <span className="text-right sm:text-left">Checks hit</span>
            <span className="hidden text-right sm:block">Change</span>
            <span className="hidden sm:block" />
          </div>
          <ul className="divide-y">
            {visible.map((issue) => {
              const sev = SEVERITY[issue.severity];
              const share = ratio(issue.runs_affected, completed) ?? 0;
              return (
                <li key={`${issue.validation_type}:${issue.severity}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(issue)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-x-4 px-5 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-neutral-900/60 dark:focus-visible:bg-neutral-900/60 sm:grid-cols-[minmax(0,1fr)_minmax(120px,200px)_72px_16px]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <sev.icon className={cn('h-4 w-4 shrink-0', sev.className)} aria-label={sev.label} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{issue.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {categoryLabel(issue.category)} · {formatCount(issue.occurrences)} found
                        </span>
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-sm font-semibold tabular-nums sm:order-2 sm:w-12 sm:text-right">{formatPercent(share)}</span>
                      <Meter value={share / maxShare} className="hidden sm:order-1 sm:block" />
                    </span>
                    <span className="hidden justify-end sm:flex">
                      <ShareChange change={shareChange(issue, overview)} isNew={isNewIssue(issue, overview)} />
                    </span>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {issues.length > COLLAPSED_COUNT && (
            <div className="border-t px-5 pt-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Show fewer' : `Show all ${issues.length} issues`}
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
