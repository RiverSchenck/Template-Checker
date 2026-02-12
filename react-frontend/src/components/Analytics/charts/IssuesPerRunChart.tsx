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

const CATEGORY_LABELS: Record<IssuesPerRunCategory, string> = {
  errors: 'Errors',
  warnings: 'Warnings',
  infos: 'Infos',
};

export function IssuesPerRunChart({ data, activeCategory, onCategoryChange }: IssuesPerRunChartProps) {
  const errorsHist =
    data?.errorsHistogram ??
    ({ errors_0: 0, errors_1_5: 0, errors_6_10: 0, errors_11_15: 0, errors_16_plus: 0 } as const);
  const warningsHist =
    data?.warningsHistogram ??
    ({ warnings_0: 0, warnings_1_5: 0, warnings_6_10: 0, warnings_11_15: 0, warnings_16_plus: 0 } as const);
  const infosHist =
    data?.infosHistogram ??
    ({ infos_0: 0, infos_1_5: 0, infos_6_10: 0, infos_11_15: 0, infos_16_plus: 0 } as const);
  const histByCategory = useMemo(
    () => ({
      errors: {
        _0: errorsHist.errors_0,
        _1_5: errorsHist.errors_1_5,
        _6_10: errorsHist.errors_6_10,
        _11_15: errorsHist.errors_11_15,
        _16_plus: errorsHist.errors_16_plus,
      },
      warnings: {
        _0: warningsHist.warnings_0,
        _1_5: warningsHist.warnings_1_5,
        _6_10: warningsHist.warnings_6_10,
        _11_15: warningsHist.warnings_11_15,
        _16_plus: warningsHist.warnings_16_plus,
      },
      infos: {
        _0: infosHist.infos_0,
        _1_5: infosHist.infos_1_5,
        _6_10: infosHist.infos_6_10,
        _11_15: infosHist.infos_11_15,
        _16_plus: infosHist.infos_16_plus,
      },
    }),
    [errorsHist, warningsHist, infosHist]
  );
  const issuesPerRunBarData = useMemo(() => {
    const h = histByCategory[activeCategory];
    return [
      { name: '0', count: h._0, fill: ISSUES_PER_RUN_PURPLE },
      { name: '1–5', count: h._1_5, fill: ISSUES_PER_RUN_PURPLE },
      { name: '6–10', count: h._6_10, fill: ISSUES_PER_RUN_PURPLE },
      { name: '11–15', count: h._11_15, fill: ISSUES_PER_RUN_PURPLE },
      { name: '16+', count: h._16_plus, fill: ISSUES_PER_RUN_PURPLE },
    ];
  }, [histByCategory, activeCategory]);
  const issuesPerRunTotalByCategory = useMemo(
    () => ({
      errors: data?.summary?.total_errors ?? 0,
      warnings: data?.summary?.total_warnings ?? 0,
      infos: data?.summary?.total_infos ?? 0,
    }),
    [data?.summary]
  );

  const tabs = useMemo(
    () =>
      (['errors', 'warnings', 'infos'] as const).map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
        value: issuesPerRunTotalByCategory[id],
      })),
    [issuesPerRunTotalByCategory]
  );

  return (
    <ChartCardWithTabs
      title="Issues per run"
      description={`How many runs had 0, 1–5, 6–10, 11–15, or 16+ ${activeCategory}`}
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
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {issuesPerRunBarData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCardWithTabs>
  );
}
