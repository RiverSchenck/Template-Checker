import React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ChartContainer, ChartTooltip } from '../ui/chart';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Skeleton } from '../ui/skeleton';
import { formatShortDate, StatusPill } from '../layout/page-kit';
import { ErrorNote, Meter } from './parts';
import { SEVERITY, isNewIssue } from './TopIssues';
import { categoryLabel, formatBucket, formatCount, formatPercent, ratio } from './format';
import { useIssueDetail } from './useAnalytics';
import type { Bucket, IssueDetail, IssueSummary, Overview, PeriodSelection } from './types';

// Identifiers are only comparable across templates for these categories (a font or style name means the same
// thing everywhere; a text box's story id doesn't).
const IDENTIFIER_HEADINGS: Record<string, string> = {
  fonts: 'Fonts involved most',
  par_styles: 'Paragraph styles involved most',
  char_styles: 'Character styles involved most',
  images: 'Images involved most',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-neutral-50/70 px-3 py-2.5 dark:bg-neutral-900/40">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const ROLLING_DAYS = 7;

/**
 * Share of checks hit per bucket. Over longer daily ranges it's a trailing 7-day share, since a quiet weekend
 * day with two checks would otherwise swing between 0% and 100%.
 */
function shareTrend(points: IssueDetail['timeseries'], rolling: boolean) {
  return points.map((p, i) => {
    const window = rolling ? points.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1) : [p];
    const hit = window.reduce((a, w) => a + w.runs_affected, 0);
    const completed = window.reduce((a, w) => a + w.completed, 0);
    return { date: p.date, runs_affected: hit, completed, share: ratio(hit, completed) };
  });
}

function TrendTooltip({
  active,
  payload,
  bucket,
  rolling,
}: {
  active?: boolean;
  payload?: { payload: { date: string; share: number | null; runs_affected: number; completed: number } }[];
  bucket: Bucket;
  rolling: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">
        {rolling ? `7 days to ${formatBucket(p.date, bucket)}` : formatBucket(p.date, bucket, true)}
      </p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{formatPercent(p.share)}</span> of checks ·{' '}
        {formatCount(p.runs_affected)} of {formatCount(p.completed)}
      </p>
    </div>
  );
}

export function IssueSheet({
  issue,
  overview,
  period,
  refresh,
  onClose,
  onShowRuns,
}: {
  issue: IssueSummary | null;
  overview: Overview;
  period: PeriodSelection;
  refresh: number;
  onClose: () => void;
  onShowRuns: (issue: IssueSummary) => void;
}) {
  const { data: detail, loading, error } = useIssueDetail(issue?.validation_type ?? null, period, refresh);
  const bucket = overview.period.bucket;
  const rolling = bucket === 'day' && (detail?.timeseries.length ?? 0) > ROLLING_DAYS * 2;
  const trend = shareTrend(detail?.timeseries ?? [], rolling);
  const identifierHeading = issue ? IDENTIFIER_HEADINGS[issue.category] : undefined;
  const topIdentifierRuns = Math.max(...(detail?.identifiers ?? []).map((i) => i.runs_affected), 1);
  const sev = issue ? SEVERITY[issue.severity] : null;

  return (
    <Sheet open={issue != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {issue && sev && (
          <>
            <SheetHeader className="border-b px-6 pb-5 pt-6 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={issue.severity === 'error' ? 'red' : issue.severity === 'warning' ? 'amber' : 'blue'} icon={sev.icon}>
                  {sev.label}
                </StatusPill>
                <span className="text-xs text-muted-foreground">{categoryLabel(issue.category)}</span>
                {isNewIssue(issue, overview) && <StatusPill tone="violet">New this period</StatusPill>}
              </div>
              <SheetTitle className="pr-6 text-xl tracking-tight">{issue.label}</SheetTitle>
              <SheetDescription>
                {issue.message || 'No description available.'}
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{issue.validation_type}</span>
              </SheetDescription>
              {issue.help_article && (
                <a
                  href={issue.help_article}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Help article <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 px-6 py-5">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Share of checks" value={formatPercent(ratio(issue.runs_affected, overview.current.completed))} />
                <Stat label="Checks hit" value={formatCount(issue.runs_affected)} />
                <Stat label="First seen" value={formatShortDate(issue.first_seen_at)} />
              </div>

              {error && <ErrorNote message={error} />}

              <div>
                <h3 className="mb-2 text-[13px] font-semibold">
                  Share of checks over time
                  {rolling && <span className="ml-1.5 font-normal text-muted-foreground">7-day rolling</span>}
                </h3>
                {loading && !detail ? (
                  <Skeleton className="h-[160px] w-full rounded-lg" />
                ) : (
                  <ChartContainer
                    config={{ share: { label: 'Share of checks', theme: { light: '#2a78d6', dark: '#3987e5' } } }}
                    className="aspect-auto h-[160px] w-full"
                  >
                    <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                      <defs>
                        <linearGradient id="issue-share-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-share)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-share)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        tickFormatter={(d: string) => formatBucket(d, bucket)}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        domain={[0, (max: number) => Math.min(1, Math.max(0.05, max * 1.15))]}
                        tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                      />
                      <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<TrendTooltip bucket={bucket} rolling={rolling} />} />
                      <Area
                        type="monotone"
                        dataKey="share"
                        stroke="var(--color-share)"
                        strokeWidth={2}
                        fill="url(#issue-share-fill)"
                        connectNulls
                        activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </div>

              {identifierHeading && (
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold">{identifierHeading}</h3>
                  {loading && !detail ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-7 w-full" />
                      ))}
                    </div>
                  ) : detail?.identifiers.length ? (
                    <ul className="space-y-2.5">
                      {detail.identifiers.slice(0, 10).map((item) => (
                        <li key={item.identifier} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                          <span className="truncate text-sm">{item.identifier}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatCount(item.runs_affected)} check{item.runs_affected === 1 ? '' : 's'}
                          </span>
                          <Meter value={item.runs_affected / topIdentifierRuns} className="col-span-2" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing recorded for this issue.</p>
                  )}
                </div>
              )}
            </div>

            <div className={cn('sticky bottom-0 border-t bg-background px-6 py-4')}>
              <Button className="w-full gap-2" onClick={() => onShowRuns(issue)}>
                Show the {formatCount(issue.runs_affected)} check{issue.runs_affected === 1 ? '' : 's'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
