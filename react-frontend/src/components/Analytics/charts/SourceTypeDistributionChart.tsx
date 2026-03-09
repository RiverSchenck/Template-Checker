import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { getSourceTypeLabel } from '../utils';
import { sourcePieColors } from '../constants';
import type { AnalyticsSummary } from '../types';

interface SourceTypeDistributionChartProps {
  data: AnalyticsSummary | null;
}

export function SourceTypeDistributionChart({ data }: SourceTypeDistributionChartProps) {
  const sourcePieData = useMemo(() => {
    if (!data?.source_types) return [];
    return Object.entries(data.source_types).map(([source, stats]) => ({
      name: getSourceTypeLabel(source),
      value: stats.count,
    }));
  }, [data?.source_types]);

  const config = useMemo(
    () =>
      Object.fromEntries(
        sourcePieData.map((d, i) => [
          d.name.replace(/\s+/g, '_'),
          { label: d.name, color: sourcePieColors[i % sourcePieColors.length] },
        ])
      ),
    [sourcePieData]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Type Distribution</CardTitle>
        <CardDescription>Runs by source (Web, Extension, API)</CardDescription>
      </CardHeader>
      <CardContent>
        {sourcePieData.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">
            No source data
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto h-[320px] w-full max-w-[380px]"
          >
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Pie
                data={sourcePieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={100}
                paddingAngle={3}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationBegin={0}
                animationDuration={800}
              >
                {sourcePieData.map((_, index) => (
                  <Cell key={index} fill={sourcePieColors[index % sourcePieColors.length]} />
                ))}
              </Pie>
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
