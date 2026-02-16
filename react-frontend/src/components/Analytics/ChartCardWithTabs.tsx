import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export interface ChartTab {
  id: string;
  label: string;
  value: string | number;
}

interface ChartCardWithTabsProps {
  title: string;
  description: string;
  tabs: ChartTab[];
  activeId: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
}

export function ChartCardWithTabs({
  title,
  description,
  tabs,
  activeId,
  onTabChange,
  children,
}: ChartCardWithTabsProps) {
  return (
    <Card className="mb-6 py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex">
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                style={isActive ? { backgroundColor: 'var(--muted)' } : undefined}
                onClick={() => onTabChange(tab.id)}
              >
                <span className="text-muted-foreground text-xs">{tab.label}</span>
                <span className="text-lg leading-none font-bold tabular-nums sm:text-3xl">
                  {typeof tab.value === 'number' ? tab.value.toLocaleString() : tab.value}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">{children}</CardContent>
    </Card>
  );
}
