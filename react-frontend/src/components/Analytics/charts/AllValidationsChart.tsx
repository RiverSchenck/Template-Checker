import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { barChartConfig } from '../constants';
import type { AnalyticsSummary } from '../types';

interface AllValidationsChartProps {
  data: AnalyticsSummary | null;
}

export function AllValidationsChart({ data }: AllValidationsChartProps) {
  const allValidationsBarData = useMemo(() => {
    const validations = data?.all_validations ?? [];
    return validations.map((v) => ({
      ...v,
      fullName: v.type,
      name: v.type.length > 24 ? v.type.slice(0, 21) + '...' : v.type,
    }));
  }, [data?.all_validations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Validations</CardTitle>
        <CardDescription>Count by validation type</CardDescription>
      </CardHeader>
      <CardContent>
        {allValidationsBarData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No validation data
          </div>
        ) : (
          <ChartContainer
            config={barChartConfig}
            className="aspect-auto min-h-[300px] w-full"
            style={{ height: Math.min(600, 120 + allValidationsBarData.length * 32) }}
          >
            <BarChart data={allValidationsBarData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={180}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName ?? '')}
                  />
                }
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationBegin={0}
                animationDuration={800}
              >
                {allValidationsBarData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.severity === 'error'
                        ? 'var(--color-error)'
                        : entry.severity === 'info'
                          ? 'var(--color-info)'
                          : 'var(--color-warning)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
