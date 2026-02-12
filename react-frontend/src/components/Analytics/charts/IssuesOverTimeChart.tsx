import React, { useMemo } from 'react';
import { Area, AreaChart, XAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { ChartCardWithTabs } from '../ChartCardWithTabs';
import { runsChartConfig, issuesChartConfig } from '../constants';
import type { RunsCategory } from '../types';
import type { AnalyticsSummary } from '../types';

interface IssuesOverTimeChartProps {
  data: AnalyticsSummary | null;
  activeCategory: RunsCategory;
  onCategoryChange: (category: RunsCategory) => void;
}

const ISSUES_OVER_TIME_KEYS: Record<RunsCategory, { errors: string; warnings: string; infos: string }> = {
  total: { errors: 'errors', warnings: 'warnings', infos: 'infos' },
  web: { errors: 'react_frontend_errors', warnings: 'react_frontend_warnings', infos: 'react_frontend_infos' },
  extension: { errors: 'extension_errors', warnings: 'extension_warnings', infos: 'extension_infos' },
  api: { errors: 'api_errors', warnings: 'api_warnings', infos: 'api_infos' },
};

const RUNS_TABS: { id: RunsCategory; configKey: 'runs' | 'react_frontend' | 'extension' | 'api' }[] = [
  { id: 'total', configKey: 'runs' },
  { id: 'web', configKey: 'react_frontend' },
  { id: 'extension', configKey: 'extension' },
  { id: 'api', configKey: 'api' },
];

export function IssuesOverTimeChart({ data, activeCategory, onCategoryChange }: IssuesOverTimeChartProps) {
  const runsOverTime = data?.runs_over_time ?? [];
  const issuesOverTimeData = useMemo(() => {
    const keys = ISSUES_OVER_TIME_KEYS[activeCategory];
    return runsOverTime.map((row: Record<string, unknown>) => ({
      date: row.date,
      errors: Number(row[keys.errors] ?? 0),
      warnings: Number(row[keys.warnings] ?? 0),
      infos: Number(row[keys.infos] ?? 0),
    }));
  }, [runsOverTime, activeCategory]);
  const issuesOverTimeTotals = useMemo(
    () => ({
      total:
        (data?.summary?.total_errors ?? 0) +
        (data?.summary?.total_warnings ?? 0) +
        (data?.summary?.total_infos ?? 0),
      web:
        (data?.source_types?.['react-frontend']?.total_errors ?? 0) +
        (data?.source_types?.['react-frontend']?.total_warnings ?? 0) +
        (data?.source_types?.['react-frontend']?.total_infos ?? 0),
      extension:
        (data?.source_types?.extension?.total_errors ?? 0) +
        (data?.source_types?.extension?.total_warnings ?? 0) +
        (data?.source_types?.extension?.total_infos ?? 0),
      api:
        (data?.source_types?.api?.total_errors ?? 0) +
        (data?.source_types?.api?.total_warnings ?? 0) +
        (data?.source_types?.api?.total_infos ?? 0),
    }),
    [data?.summary, data?.source_types]
  );

  const tabs = useMemo(
    () =>
      RUNS_TABS.map(({ id, configKey }) => ({
        id,
        label: runsChartConfig[configKey].label as string,
        value: issuesOverTimeTotals[id],
      })),
    [issuesOverTimeTotals]
  );

  return (
    <ChartCardWithTabs
      title="Issues Over Time"
      description="Errors, warnings, and infos by day"
      tabs={tabs}
      activeId={activeCategory}
      onTabChange={(id) => onCategoryChange(id as RunsCategory)}
    >
      <ChartContainer config={issuesChartConfig} className="aspect-auto h-[250px] w-full">
        <AreaChart data={issuesOverTimeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="issuesFillErrors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-errors)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-errors)" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="issuesFillWarnings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-warnings)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-warnings)" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="issuesFillInfos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-infos)" stopOpacity={0.7} />
              <stop offset="95%" stopColor="var(--color-infos)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                indicator="dot"
              />
            }
          />
          <Area
            dataKey="infos"
            type="natural"
            fill="url(#issuesFillInfos)"
            stroke="var(--color-infos)"
            strokeWidth={2}
          />
          <Area
            dataKey="warnings"
            type="natural"
            fill="url(#issuesFillWarnings)"
            stroke="var(--color-warnings)"
            strokeWidth={2}
          />
          <Area
            dataKey="errors"
            type="natural"
            fill="url(#issuesFillErrors)"
            stroke="var(--color-errors)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCardWithTabs>
  );
}
