import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { severityPieColors } from '../constants';
import type { AnalyticsSummary } from '../types';

interface SeverityDistributionChartProps {
  data: AnalyticsSummary | null;
}

export function SeverityDistributionChart({ data }: SeverityDistributionChartProps) {
  const severityPieData = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { name: 'Errors', value: data.summary.total_errors },
      { name: 'Warnings', value: data.summary.total_warnings },
      { name: 'Infos', value: data.summary.total_infos },
    ];
  }, [data?.summary]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Severity Distribution</CardTitle>
        <CardDescription>Errors vs warnings vs infos</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="mx-auto h-[320px] w-full max-w-[380px]">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Pie
              data={severityPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={100}
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {severityPieData.map((_, index) => (
                <Cell key={index} fill={severityPieColors[index]} />
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
      </CardContent>
    </Card>
  );
}
