import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { ChartCardWithTabs } from '../ChartCardWithTabs';
import { errorsPerRunChartConfig, ISSUES_PER_RUN_PURPLE } from '../constants';
import type { IssuesPerRunCategory } from '../types';
import type { AnalyticsSummary } from '../types';

interface IssuesPerRunChartProps {
  data: AnalyticsSummary | null;
  activeCategory: IssuesPerRunCategory;
  onCategoryChange: (category: IssuesPerRunCategory) => void;
}

export function IssuesPerRunChart({ data, activeCategory, onCategoryChange }: IssuesPerRunChartProps) {
  const histogram = activeCategory === 'errors' ? data?.errorsHistogram : activeCategory === 'warnings' ? data?.warningsHistogram : data?.infosHistogram;
  const keyPrefix = activeCategory === 'errors' ? 'errors' : activeCategory === 'warnings' ? 'warnings' : 'infos';
  const issuesPerRunBarData = useMemo(() => {
    if (!histogram) return [];
    const keys = keyPrefix === 'errors'
      ? ['errors_0', 'errors_1_5', 'errors_6_10', 'errors_11_15', 'errors_16_plus']
      : keyPrefix === 'warnings'
        ? ['warnings_0', 'warnings_1_5', 'warnings_6_10', 'warnings_11_15', 'warnings_16_plus']
        : ['infos_0', 'infos_1_5', 'infos_6_10', 'infos_11_15', 'infos_16_plus'];
    const labels = ['0', '1–5', '6–10', '11–15', '16+'];
    return keys.map((k, i) => ({
      name: labels[i],
      count: (histogram as Record<string, number>)[k] ?? 0,
      fill: ISSUES_PER_RUN_PURPLE,
    }));
  }, [histogram, keyPrefix]);

  const tabs = useMemo(
    () => [
      { id: 'errors' as IssuesPerRunCategory, label: 'Errors', value: data?.summary?.total_errors ?? 0 },
      { id: 'warnings' as IssuesPerRunCategory, label: 'Warnings', value: data?.summary?.total_warnings ?? 0 },
      { id: 'infos' as IssuesPerRunCategory, label: 'Infos', value: data?.summary?.total_infos ?? 0 },
    ],
    [data?.summary]
  );

  return (
    <ChartCardWithTabs
      title="Issues Per Run"
      description="Distribution of issue counts per run"
      tabs={tabs}
      activeId={activeCategory}
      onTabChange={(id) => onCategoryChange(id as IssuesPerRunCategory)}
    >
      <ChartContainer config={errorsPerRunChartConfig} className="aspect-auto h-[300px] w-full">
        <BarChart data={issuesPerRunBarData} layout="vertical" margin={{ left: 0, right: 10 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            isAnimationActive
            animationBegin={200}
            animationDuration={800}
          >
            {issuesPerRunBarData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCardWithTabs>
  );
}
