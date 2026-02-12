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
  const sortedValidations = useMemo(() => {
    if (!data?.all_validations) return [];
    return [...data.all_validations].sort((a, b) => b.count - a.count);
  }, [data?.all_validations]);

  const allValidationsBarData = useMemo(
    () =>
      sortedValidations.map((v) => ({
        name: v.type.length > 20 ? v.type.substring(0, 20) + '...' : v.type,
        count: v.count,
        fullName: v.type,
        severity: v.severity,
      })),
    [sortedValidations]
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>All Validation Types</CardTitle>
        <CardDescription>Validation type and count by severity</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedValidations.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No validations
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
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
