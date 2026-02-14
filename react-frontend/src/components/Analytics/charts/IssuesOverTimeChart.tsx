import React, { useMemo } from 'react';
import { Area, AreaChart, XAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { ChartCardWithTabs } from '../ChartCardWithTabs';
import { issuesChartConfig } from '../constants';
import { formatChartDate } from '../utils';
import type { RunsCategory } from '../types';
import type { AnalyticsSummary } from '../types';

const ISSUES_OVER_TIME_KEYS: Record<RunsCategory, { errors: string; warnings: string; infos: string }> = {
  total: { errors: 'errors', warnings: 'warnings', infos: 'infos' },
  web: { errors: 'react_frontend_errors', warnings: 'react_frontend_warnings', infos: 'react_frontend_infos' },
  extension: { errors: 'extension_errors', warnings: 'extension_warnings', infos: 'extension_infos' },
  api: { errors: 'api_errors', warnings: 'api_warnings', infos: 'api_infos' },
};

interface IssuesOverTimeChartProps {
  data: AnalyticsSummary | null;
  activeCategory: RunsCategory;
  onCategoryChange: (category: RunsCategory) => void;
}

export function IssuesOverTimeChart({ data, activeCategory, onCategoryChange }: IssuesOverTimeChartProps) {
  const keys = ISSUES_OVER_TIME_KEYS[activeCategory];
  const runsOverTime = data?.runs_over_time ?? [];
  const issuesOverTimeData = useMemo(() => {
    return runsOverTime.map((row: Record<string, unknown>) => ({
      ...row,
      date: row.date,
      errors: Number(row[keys.errors] ?? 0),
      warnings: Number(row[keys.warnings] ?? 0),
      infos: Number(row[keys.infos] ?? 0),
    }));
  }, [runsOverTime, keys]);

  const tabs = useMemo(() => {
    const runsOverTime = data?.runs_over_time ?? [];
    const totalValue = runsOverTime.reduce(
      (sum, row: Record<string, unknown>) =>
        sum + Number(row.errors ?? 0) + Number(row.warnings ?? 0) + Number(row.infos ?? 0),
      0
    );
    const rf = data?.source_types?.['react-frontend'];
    const ext = data?.source_types?.extension;
    const apiTypes = data?.source_types?.api;
    return [
      { id: 'total' as RunsCategory, label: 'Total', value: totalValue },
      { id: 'web' as RunsCategory, label: 'Web', value: (rf?.total_errors ?? 0) + (rf?.total_warnings ?? 0) + (rf?.total_infos ?? 0) },
      { id: 'extension' as RunsCategory, label: 'Extension', value: (ext?.total_errors ?? 0) + (ext?.total_warnings ?? 0) + (ext?.total_infos ?? 0) },
      { id: 'api' as RunsCategory, label: 'API', value: (apiTypes?.total_errors ?? 0) + (apiTypes?.total_warnings ?? 0) + (apiTypes?.total_infos ?? 0) },
    ];
  }, [data?.runs_over_time, data?.source_types]);

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
            tickFormatter={(value) => formatChartDate(String(value))}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  formatChartDate(String(value), { month: 'short', day: 'numeric' })
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
            isAnimationActive
            animationBegin={200}
            animationDuration={800}
          />
          <Area
            dataKey="warnings"
            type="natural"
            fill="url(#issuesFillWarnings)"
            stroke="var(--color-warnings)"
            strokeWidth={2}
            isAnimationActive
            animationBegin={200}
            animationDuration={800}
          />
          <Area
            dataKey="errors"
            type="natural"
            fill="url(#issuesFillErrors)"
            stroke="var(--color-errors)"
            strokeWidth={2}
            isAnimationActive
            animationBegin={200}
            animationDuration={800}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCardWithTabs>
  );
}
