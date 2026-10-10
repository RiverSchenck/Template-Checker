import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Segmented } from '../layout/page-kit';
import { LegendItem, SectionCard } from './parts';
import { formatBucket, formatCount, formatPercent, ratio } from './format';
import type { Bucket, Overview, TimeseriesPoint } from './types';

type View = 'source' | 'outcome';
type Display = 'chart' | 'table';

// Categorical slots 1-3 (blue, orange, aqua), validated colorblind-safe as a set in both themes.
const SOURCE_SERIES = [
  { key: 'web', label: 'Web', light: '#2a78d6', dark: '#3987e5', swatch: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { key: 'extension', label: 'Extension', light: '#eb6834', dark: '#d95926', swatch: 'bg-[#eb6834] dark:bg-[#d95926]' },
  { key: 'api', label: 'API', light: '#1baf7a', dark: '#199e70', swatch: 'bg-[#1baf7a] dark:bg-[#199e70]' },
] as const;

// Outcome colors are status colors: they mean good / attention / broken.
const OUTCOME_SERIES = [
  { key: 'completed', label: 'Completed', light: '#a3a3a3', dark: '#737373', swatch: 'bg-[#a3a3a3] dark:bg-[#737373]' },
  { key: 'rejected', label: 'Rejected upload', light: '#f59e0b', dark: '#d97706', swatch: 'bg-[#f59e0b] dark:bg-[#d97706]' },
  { key: 'failed', label: 'Crashed', light: '#e11d48', dark: '#f43f5e', swatch: 'bg-[#e11d48] dark:bg-[#f43f5e]' },
] as const;

type Series = readonly { key: keyof TimeseriesPoint; label: string; light: string; dark: string; swatch: string }[];

function configFor(series: Series): ChartConfig {
  return Object.fromEntries(series.map((s) => [s.key, { label: s.label, theme: { light: s.light, dark: s.dark } }]));
}

function UsageTooltip({
  active,
  payload,
  series,
  bucket,
}: {
  active?: boolean;
  payload?: { payload: TimeseriesPoint }[];
  series: Series;
  bucket: Bucket;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-foreground">{formatBucket(point.date, bucket, true)}</p>
      <div className="space-y-1">
        {[...series].reverse().map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: `var(--color-${s.key})` }} />
              {s.label}
            </span>
            <span className="font-medium tabular-nums text-foreground">{formatCount(point[s.key] as number)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t pt-2 text-muted-foreground">
        <span>Total</span>
        <span className="font-medium tabular-nums text-foreground">{formatCount(point.runs)}</span>
      </div>
    </div>
  );
}

function DisplayToggle({ value, onChange }: { value: Display; onChange: (d: Display) => void }) {
  const options: { value: Display; label: string; icon: typeof BarChart3 }[] = [
    { value: 'chart', label: 'Show as chart', icon: BarChart3 },
    { value: 'table', label: 'Show as table', icon: Table2 },
  ];
  return (
    <div
      role="group"
      aria-label="Display"
      className="inline-flex h-9 items-center gap-0.5 rounded-lg border bg-neutral-100 p-0.5 dark:bg-neutral-900"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          title={o.label}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'grid h-full w-8 place-items-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value
              ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <o.icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** The chart's numbers as a table: for screen readers, exact values, and copying into a doc. */
function UsageTable({ timeseries, series, bucket }: { timeseries: TimeseriesPoint[]; series: Series; bucket: Bucket }) {
  return (
    <div className="max-h-[300px] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-xs text-muted-foreground dark:bg-neutral-900">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {bucket === 'week' ? 'Week of' : 'Day'}
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...timeseries].reverse().map((p) => (
            <tr key={p.date}>
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                {formatBucket(p.date, bucket, true)}
              </th>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {formatCount(p[s.key] as number)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatCount(p.runs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsageChart({ overview }: { overview: Overview }) {
  const [view, setView] = useState<View>('source');
  const { timeseries, current, period } = overview;
  const [display, setDisplay] = useState<Display>('chart');
  const series: Series = view === 'source' ? SOURCE_SERIES : OUTCOME_SERIES;
  const totals = Object.fromEntries(series.map((s) => [s.key, timeseries.reduce((a, p) => a + (p[s.key] as number), 0)]));

  return (
    <SectionCard
      title="Checks over time"
      description={
        view === 'source'
          ? 'Where support runs the checker from'
          : `${formatPercent(ratio(current.completed, current.runs))} of checks completed`
      }
      info={
        <>
          <strong>Source</strong>: Web is the checker site, Extension the browser extension, API calls made with an API
          key. <strong>Outcome</strong>: completed, rejected upload, or crashed. Ranges over 90 days are grouped by week.
        </>
      }
      action={
        <>
          <Segmented<View>
            ariaLabel="Split checks by"
            value={view}
            onChange={setView}
            options={[
              { value: 'source', label: 'By source' },
              { value: 'outcome', label: 'By outcome' },
            ]}
          />
          <DisplayToggle value={display} onChange={setDisplay} />
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <LegendItem
            key={s.key}
            swatchClass={s.swatch}
            label={s.label}
            value={formatCount(totals[s.key])}
          />
        ))}
      </div>
      {display === 'table' ? (
        <UsageTable timeseries={timeseries} series={series} bucket={period.bucket} />
      ) : (
        <ChartContainer config={configFor(series)} className="aspect-auto h-[260px] w-full">
          <BarChart data={timeseries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tickFormatter={(d: string) => formatBucket(d, period.bucket)}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <ChartTooltip
              cursor={{ fill: 'var(--muted)' }}
              content={<UsageTooltip series={series} bucket={period.bucket} />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="checks"
                fill={`var(--color-${s.key})`}
                stroke="var(--card)"
                strokeWidth={1}
                radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      )}
    </SectionCard>
  );
}
