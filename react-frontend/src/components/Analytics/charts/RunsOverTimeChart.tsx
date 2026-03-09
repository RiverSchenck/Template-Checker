import React, { useMemo } from 'react';
import { Line, LineChart, XAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { ChartCardWithTabs } from '../ChartCardWithTabs';
import { runsChartConfig } from '../constants';
import { formatChartDate } from '../utils';
import type { RunsCategory } from '../types';
import type { AnalyticsSummary } from '../types';

interface RunsOverTimeChartProps {
  data: AnalyticsSummary | null;
  activeCategory: RunsCategory;
  onCategoryChange: (category: RunsCategory) => void;
}

const RUNS_TABS: { id: RunsCategory; configKey: 'runs' | 'react_frontend' | 'extension' | 'api' }[] = [
  { id: 'total', configKey: 'runs' },
  { id: 'web', configKey: 'react_frontend' },
  { id: 'extension', configKey: 'extension' },
  { id: 'api', configKey: 'api' },
];

export function RunsOverTimeChart({ data, activeCategory, onCategoryChange }: RunsOverTimeChartProps) {
  const runsOverTime = data?.runs_over_time ?? [];
  const runsOverTimeWithSources = useMemo(
    () =>
      runsOverTime.map((row: { date: string; runs: number; [k: string]: unknown }) => ({
        ...row,
        react_frontend: (row as { react_frontend?: number }).react_frontend ?? 0,
        extension: (row as { extension?: number }).extension ?? 0,
        api: (row as { api?: number }).api ?? 0,
      })),
    [runsOverTime]
  );
  const runsCategoryTotals = useMemo(
    () => ({
      total: runsOverTime.reduce((acc, curr) => acc + curr.runs, 0),
      web: data?.source_types?.['react-frontend']?.count ?? 0,
      extension: data?.source_types?.['extension']?.count ?? 0,
      api: data?.source_types?.['api']?.count ?? 0,
    }),
    [runsOverTime, data?.source_types]
  );
  const runsChartDataKey =
    activeCategory === 'total' ? 'runs' : activeCategory === 'web' ? 'react_frontend' : activeCategory;

  const tabs = useMemo(
    () =>
      RUNS_TABS.map(({ id, configKey }) => ({
        id,
        label: runsChartConfig[configKey].label as string,
        value: runsCategoryTotals[id],
      })),
    [runsCategoryTotals]
  );

  return (
    <ChartCardWithTabs
      title="Runs Over Time"
      description="Template check runs for the selected period"
      tabs={tabs}
      activeId={activeCategory}
      onTabChange={(id) => onCategoryChange(id as RunsCategory)}
    >
      <ChartContainer config={runsChartConfig} className="aspect-auto h-[250px] w-full">
        <LineChart accessibilityLayer data={runsOverTimeWithSources} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value) => formatChartDate(String(value))}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[150px]"
                labelFormatter={(value) =>
                  formatChartDate(String(value), {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }
              />
            }
          />
          <Line
            key={activeCategory}
            dataKey={runsChartDataKey}
            type="monotone"
            stroke={`var(--color-${runsChartDataKey})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationBegin={0}
            animationDuration={800}
          />
        </LineChart>
      </ChartContainer>
    </ChartCardWithTabs>
  );
}
