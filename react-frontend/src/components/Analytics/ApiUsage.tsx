import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { CheckCircle2, KeyRound, PlugZap } from 'lucide-react';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { EmptyState, formatAbsolute, formatRelativeInline, formatShortDate, PersonAvatar, StatusPill } from '../layout/page-kit';
import { CopyButton, ErrorNote, LegendItem, Meter, SectionCard } from './parts';
import { Tile, pointsDelta, relativeDelta, type Delta } from './KpiTiles';
import { formatDays } from './PeriodBar';
import { formatBucket, formatCount, formatDuration, formatPercent, personLabel, ratio } from './format';
import type { ApiPeriodStats, ApiTimeseriesPoint, ApiUsage as ApiUsageData, Bucket, Overview } from './types';

/** Endpoints kept for old integrations; calls to them are worth moving to /v1. */
const DEPRECATED_ENDPOINTS: Record<string, string> = {
  '/run': '/v1/checks',
  '/summary': '/v1/checks/summary',
  '/run-and-download-xml': '/v1/checks/xml',
};

// Outcome colors are status colors, as in Checks over time: fine / caller's mistake / ours.
const SERIES = [
  { key: 'succeeded', label: 'Succeeded', light: '#a3a3a3', dark: '#737373', swatch: 'bg-[#a3a3a3] dark:bg-[#737373]' },
  { key: 'client_errors', label: 'Client errors (4xx)', light: '#f59e0b', dark: '#d97706', swatch: 'bg-[#f59e0b] dark:bg-[#d97706]' },
  { key: 'server_errors', label: 'Server errors (5xx)', light: '#e11d48', dark: '#f43f5e', swatch: 'bg-[#e11d48] dark:bg-[#f43f5e]' },
] as const;

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  SERIES.map((s) => [s.key, { label: s.label, theme: { light: s.light, dark: s.dark } }])
);

const successRate = (s: ApiPeriodStats) => ratio(s.succeeded, s.requests);
const errorRate = (errors: number, requests: number) => ratio(errors, requests) ?? 0;

function ApiTiles({ usage, overview }: { usage: ApiUsageData; overview: Overview }) {
  const { current: cur, previous: prev, timeseries } = usage;
  // Only compare once requests were being recorded for the whole previous period.
  const comparable = Boolean(usage.data_since) && new Date(usage.data_since!) <= new Date(overview.period.previous_start);
  const compare = (delta: Delta | null) => (comparable ? delta : null);
  const comparedWith = formatDays(
    new Date(overview.period.previous_start),
    new Date(new Date(overview.period.start).getTime() - 1)
  );
  const failed = cur.client_errors + cur.server_errors;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        comparedWith={comparedWith}
        label="Requests"
        info="Every request made with an API key in this period, including ones with an invalid key or that were rejected."
        value={formatCount(cur.requests)}
        delta={compare(relativeDelta(cur.requests, prev.requests, 'up'))}
        spark={timeseries.map((p) => p.succeeded + p.client_errors + p.server_errors)}
        detail={`${formatCount(cur.succeeded)} succeeded · ${formatCount(failed)} failed`}
      />
      <Tile
        comparedWith={comparedWith}
        label="Success rate"
        info="Share of requests answered without an error. Client errors (4xx) are usually the caller's: a bad key, no file, or the rate limit. Server errors (5xx) are ours."
        value={formatPercent(successRate(cur))}
        delta={compare(pointsDelta(successRate(cur), successRate(prev), 'up'))}
        spark={timeseries.map((p) => ratio(p.succeeded, p.succeeded + p.client_errors + p.server_errors))}
        rate
        detail={`${formatCount(cur.client_errors)} client errors · ${formatCount(cur.server_errors)} server errors`}
      />
      <Tile
        comparedWith={comparedWith}
        label="Response time (p95)"
        info="95% of successful requests were answered within this time, from receiving the upload to sending the response."
        value={formatDuration(cur.p95_duration_ms)}
        delta={
          cur.p95_duration_ms != null && prev.p95_duration_ms != null
            ? compare(relativeDelta(cur.p95_duration_ms, prev.p95_duration_ms, 'down'))
            : null
        }
        detail={`Typical ${formatDuration(cur.p50_duration_ms)}`}
      />
      <Tile
        comparedWith={comparedWith}
        label="Keys in use"
        info="Distinct API keys that made at least one request. Invalid-key attempts used a key that is unknown, expired or revoked."
        value={formatCount(cur.active_keys)}
        delta={compare({ value: cur.active_keys - prev.active_keys, kind: 'absolute', better: 'up' })}
        detail={`${formatCount(cur.active_users)} ${cur.active_users === 1 ? 'person' : 'people'} · ${formatCount(cur.invalid_key)} invalid-key attempts`}
      />
    </div>
  );
}

function RequestsTooltip({ active, payload, bucket }: { active?: boolean; payload?: { payload: ApiTimeseriesPoint }[]; bucket: Bucket }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-2 font-medium text-foreground">{formatBucket(point.bucket, bucket, true)}</p>
      <div className="space-y-1">
        {[...SERIES].reverse().map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: `var(--color-${s.key})` }} />
              {s.label}
            </span>
            <span className="font-medium tabular-nums text-foreground">{formatCount(point[s.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsChart({ usage, bucket }: { usage: ApiUsageData; bucket: Bucket }) {
  const totals = Object.fromEntries(SERIES.map((s) => [s.key, usage.timeseries.reduce((a, p) => a + p[s.key], 0)]));
  return (
    <SectionCard
      title="Requests over time"
      description="API-key requests by outcome"
      info="Ranges over 90 days are grouped by week."
    >
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {SERIES.map((s) => (
          <LegendItem key={s.key} swatchClass={s.swatch} label={s.label} value={formatCount(totals[s.key])} />
        ))}
      </div>
      <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[240px] w-full">
        <BarChart data={usage.timeseries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            tickFormatter={(d: string) => formatBucket(d, bucket)}
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<RequestsTooltip bucket={bucket} />} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="requests"
              fill={`var(--color-${s.key})`}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </SectionCard>
  );
}

function Endpoints({ usage }: { usage: ApiUsageData }) {
  const top = Math.max(...usage.endpoints.map((e) => e.requests), 1);
  return (
    <SectionCard
      title="Endpoints"
      description="What callers use the API for"
      info="Old paths still work but are deprecated; the tag names the /v1 endpoint to move to."
      bodyClassName="px-0 pb-2"
    >
      <ul className="divide-y border-t">
        {usage.endpoints.map((e) => (
          <li key={e.endpoint} className="px-5 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <code className="truncate text-[13px] font-medium">{e.endpoint}</code>
                {DEPRECATED_ENDPOINTS[e.endpoint] && (
                  <StatusPill tone="amber">Deprecated · use {DEPRECATED_ENDPOINTS[e.endpoint]}</StatusPill>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(e.requests)}</span>
            </div>
            <Meter value={e.requests / top} className="my-1.5" />
            <p className="truncate text-xs text-muted-foreground">
              {formatPercent(errorRate(e.errors, e.requests))} errors · p95 {formatDuration(e.p95_duration_ms)} · last{' '}
              <span title={formatAbsolute(e.last_request_at)}>{formatRelativeInline(e.last_request_at)}</span>
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Errors({ usage }: { usage: ApiUsageData }) {
  return (
    <SectionCard
      title="Errors"
      description="Error codes returned, most frequent first"
      info="The error.code in the response body (see the API docs). http_<status> means the response had no code."
      bodyClassName="px-0 pb-2"
    >
      {usage.errors.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No errors" description="Every request in this period succeeded." />
      ) : (
        <ul className="divide-y border-t">
          {usage.errors.map((e) => (
            <li key={`${e.error_code}:${e.status_code}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <StatusPill tone={e.status_code >= 500 ? 'red' : 'amber'}>{e.status_code}</StatusPill>
                <code className="truncate text-[13px]">{e.error_code}</code>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(e.requests)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function expiryLabel(key: { expires_at: string | null; revoked_at: string | null }): React.ReactNode {
  if (key.revoked_at) return <StatusPill tone="red">Revoked</StatusPill>;
  if (!key.expires_at) return 'Never expires';
  const expired = new Date(key.expires_at).getTime() <= Date.now();
  return (
    <span title={formatAbsolute(key.expires_at)}>
      {expired ? 'Expired' : 'Expires'} {formatShortDate(key.expires_at)}
    </span>
  );
}

function Keys({ usage }: { usage: ApiUsageData }) {
  return (
    <SectionCard
      title="Keys"
      description="Which keys made requests in this period, and whose they are"
      info="Requests with an invalid key aren't tied to a key, so they're only in the totals and the failure list."
      bodyClassName="px-0 pb-2"
    >
      {usage.keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="No keys used" description="No valid key made a request in this period." />
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-5 py-2 text-left font-medium">Key</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Owner</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Requests</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Errors</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Last request</th>
                <th scope="col" className="px-5 py-2 text-left font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usage.keys.map((k) => (
                <tr key={k.key_id}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{k.name}</p>
                    <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <PersonAvatar name={k.display_name} email={k.email} src={k.avatar_url} size="sm" />
                      <span className="truncate">{personLabel(k.display_name, k.email)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatCount(k.requests)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatPercent(errorRate(k.errors, k.requests))}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground" title={formatAbsolute(k.last_request_at)}>
                    {formatRelativeInline(k.last_request_at)}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{expiryLabel(k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function RecentFailures({ usage }: { usage: ApiUsageData }) {
  if (usage.recent_failures.length === 0) return null;
  return (
    <SectionCard
      title="Recent failures"
      description="The latest failed requests. Copy a request ID to find the request in the server logs."
      bodyClassName="px-0 pb-2"
    >
      <ul className="divide-y border-t">
        {usage.recent_failures.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-5 py-2.5">
            <StatusPill tone={f.status_code >= 500 ? 'red' : 'amber'}>{f.status_code}</StatusPill>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-baseline gap-2">
                <code className="truncate text-[13px] font-medium">{f.error_code ?? `http_${f.status_code}`}</code>
                <span className="truncate text-xs text-muted-foreground">
                  {f.method} {f.endpoint}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {f.key_name ? `${f.key_name} (${personLabel(f.display_name, f.email)})` : 'Invalid key'} ·{' '}
                {formatDuration(f.duration_ms)}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <span title={formatAbsolute(f.created_at)}>{formatRelativeInline(f.created_at)}</span>
              {f.request_id && <CopyButton value={f.request_id} label="Copy request ID" />}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** How the API is used (admin only): requests, endpoints, keys and errors. */
export function ApiUsage({
  usage,
  overview,
  error,
  onRetry,
}: {
  usage: ApiUsageData | null;
  overview: Overview;
  error: string | null;
  onRetry: () => void;
}) {
  if (!usage) return error ? <ErrorNote message={error} onRetry={onRetry} /> : null;
  if (usage.current.requests === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={PlugZap}
          title="No API requests in this period"
          description={
            usage.data_since
              ? 'Nobody called the API with a key in these dates. Try a longer range.'
              : 'API requests are recorded from now on. Calls made with an API key will show up here.'
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {error && <ErrorNote message={`Couldn't refresh: ${error}`} onRetry={onRetry} />}
      <ApiTiles usage={usage} overview={overview} />
      <RequestsChart usage={usage} bucket={overview.period.bucket} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Endpoints usage={usage} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Errors usage={usage} />
        </div>
      </div>
      <Keys usage={usage} />
      <RecentFailures usage={usage} />
    </div>
  );
}
