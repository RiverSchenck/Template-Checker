import React from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { InfoTip } from './parts';
import { formatDays } from './PeriodBar';
import { formatCount, formatPercent, hasFullPreviousPeriod, ratio } from './format';
import type { Overview, PeriodStats, TimeseriesPoint } from './types';

type Better = 'up' | 'down';

interface Delta {
  /** Signed change: a fraction for counts (0.12 = +12%), percentage points for rates (0.05 = +5 pts). */
  value: number;
  kind: 'relative' | 'points' | 'absolute';
  better: Better;
}

function relativeDelta(current: number, previous: number, better: Better): Delta | null {
  if (previous <= 0) return null;
  return { value: (current - previous) / previous, kind: 'relative', better };
}

function pointsDelta(current: number | null, previous: number | null, better: Better): Delta | null {
  if (current == null || previous == null) return null;
  return { value: current - previous, kind: 'points', better };
}

function DeltaBadge({ delta, comparedWith }: { delta: Delta | null; comparedWith: string }) {
  if (!delta) {
    return <span className="text-xs text-muted-foreground">No full earlier period to compare</span>;
  }
  const { value, kind, better } = delta;
  const flat = kind === 'relative' ? Math.abs(value) < 0.005 : kind === 'points' ? Math.abs(value) < 0.0005 : value === 0;
  const good = better === 'up' ? value > 0 : value < 0;
  const text =
    kind === 'relative'
      ? `${Math.abs(Math.round(value * 100))}%`
      : kind === 'points'
        ? `${Math.abs(value * 100).toFixed(1)} pts`
        : formatCount(Math.abs(value));
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums',
          flat
            ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            : good
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        {flat ? 'No change' : text}
      </span>
      <span className="truncate text-muted-foreground">vs {comparedWith}</span>
    </span>
  );
}

/** Counts start at zero; rates zoom to their own range so a dip from 98% to 92% is visible. */
function Sparkline({ values, rate = false }: { values: (number | null)[]; rate?: boolean }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = React.useId().replace(/:/g, '');
  return (
    <div className="h-10 w-full text-neutral-400 dark:text-neutral-500" aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis
            hide
            domain={
              rate
                ? [(min: number) => Math.max(0, min - 0.05), (max: number) => Math.min(1, max + 0.01)]
                : [0, 'dataMax']
            }
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.5}
            fill={`url(#spark-${id})`}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tile({
  label,
  value,
  delta,
  detail,
  spark,
  rate = false,
  info,
  comparedWith,
}: {
  label: string;
  comparedWith: string;
  info: React.ReactNode;
  value: string;
  delta: Delta | null;
  detail: React.ReactNode;
  spark: (number | null)[];
  rate?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        {label}
        <InfoTip label={`About ${label}`}>{info}</InfoTip>
      </p>
      <p className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <div className="mt-2.5">
        <DeltaBadge delta={delta} comparedWith={comparedWith} />
      </div>
      <div className="mt-3">
        <Sparkline values={spark} rate={rate} />
      </div>
      <p className="mt-2 truncate border-t pt-2.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

const successRate = (s: PeriodStats) => ratio(s.completed, s.runs);
const cleanRate = (s: PeriodStats) => ratio(s.clean_runs, s.completed);
const series = (points: TimeseriesPoint[], f: (p: TimeseriesPoint) => number | null) => points.map(f);

export function KpiTiles({ overview }: { overview: Overview }) {
  const { current: cur, previous: prev, timeseries } = overview;
  const perAgent = ratio(cur.runs, cur.active_users);
  // Only compare when data collection covers the whole previous period.
  const comparable = hasFullPreviousPeriod(overview);
  // The previous period ends where this one starts; show its last day, not the boundary.
  const comparedWith = formatDays(
    new Date(overview.period.previous_start),
    new Date(new Date(overview.period.start).getTime() - 1)
  );
  const compare = (delta: Delta | null) => (comparable ? delta : null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        comparedWith={comparedWith}
        label="Checks run"
        info="Every check started in this period, including ones that crashed or whose upload was rejected."
        value={formatCount(cur.runs)}
        delta={compare(relativeDelta(cur.runs, prev.runs, 'up'))}
        spark={series(timeseries, (p) => p.runs)}
        detail={`${formatCount(cur.completed)} completed · ${formatCount(cur.runs - cur.completed)} didn't finish`}
      />
      <Tile
        comparedWith={comparedWith}
        label="Success rate"
        info="Share of checks that ran every check and returned results. The rest crashed, or the upload couldn't be opened."
        value={formatPercent(successRate(cur))}
        delta={compare(pointsDelta(successRate(cur), successRate(prev), 'up'))}
        spark={series(timeseries, (p) => ratio(p.completed, p.runs))}
        rate
        detail={`${formatCount(cur.failed)} crashed · ${formatCount(cur.rejected)} rejected uploads`}
      />
      <Tile
        comparedWith={comparedWith}
        label="Templates with no blockers"
        info="Share of completed checks that found no blockers (warnings and infos don't count). Expect this to be low: support mostly checks templates customers are struggling with."
        value={formatPercent(cleanRate(cur))}
        delta={compare(pointsDelta(cleanRate(cur), cleanRate(prev), 'up'))}
        spark={series(timeseries, (p) => ratio(p.clean_runs, p.completed))}
        rate
        detail={
          cur.median_errors == null
            ? 'No completed checks'
            : `Typical check finds ${formatCount(Math.round(cur.median_errors))} blocker${Math.round(cur.median_errors) === 1 ? '' : 's'}`
        }
      />
      <Tile
        comparedWith={comparedWith}
        label="Active agents"
        info="Signed-in people who ran at least one check in this period."
        value={formatCount(cur.active_users)}
        delta={compare({ value: cur.active_users - prev.active_users, kind: 'absolute', better: 'up' })}
        spark={series(timeseries, (p) => p.active_users)}
        detail={perAgent == null ? 'No checks yet' : `${perAgent.toFixed(1)} checks per agent`}
      />
    </div>
  );
}
