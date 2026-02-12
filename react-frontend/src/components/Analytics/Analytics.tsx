import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import '../../App.css';

import type { RunsCategory, IssuesPerRunCategory } from './types';
import { RECENT_RUNS_PAGE_SIZE } from './constants';
import { useAnalytics } from './useAnalytics';
import { SummaryCards } from './SummaryCards';
import { RecentRunsTable } from './RecentRunsTable';
import { RunsOverTimeChart } from './charts/RunsOverTimeChart';
import { IssuesOverTimeChart } from './charts/IssuesOverTimeChart';
import { IssuesPerRunChart } from './charts/IssuesPerRunChart';
import { SourceTypeDistributionChart } from './charts/SourceTypeDistributionChart';
import { SeverityDistributionChart } from './charts/SeverityDistributionChart';
import { AllValidationsChart } from './charts/AllValidationsChart';

function Analytics() {
  const { loading, error, data, days, setDays } = useAnalytics();
  const [activeRunsCategory, setActiveRunsCategory] = useState<RunsCategory>('total');
  const [activeIssuesOverTimeCategory, setActiveIssuesOverTimeCategory] = useState<RunsCategory>('total');
  const [activeIssuesPerRunCategory, setActiveIssuesPerRunCategory] = useState<IssuesPerRunCategory>('errors');
  const [recentRunsPage, setRecentRunsPage] = useState(0);

  // Reset to first page when time range or data changes
  useEffect(() => {
    setRecentRunsPage(0);
  }, [data, days]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 px-4 pt-12">
        <div className="flex w-full max-w-4xl flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Analytics</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-w-0 w-full max-w-[1400px] overflow-x-hidden px-4 pb-8 pt-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-guise m-0 text-2xl font-semibold">Analytics</h1>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[180px]" aria-label="Time range">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SummaryCards summary={data.summary} />

      <RunsOverTimeChart
        data={data}
        activeCategory={activeRunsCategory}
        onCategoryChange={setActiveRunsCategory}
      />
      <IssuesOverTimeChart
        data={data}
        activeCategory={activeIssuesOverTimeCategory}
        onCategoryChange={setActiveIssuesOverTimeCategory}
      />
      <IssuesPerRunChart
        data={data}
        activeCategory={activeIssuesPerRunCategory}
        onCategoryChange={setActiveIssuesPerRunCategory}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SourceTypeDistributionChart data={data} />
        <SeverityDistributionChart data={data} />
      </div>

      <AllValidationsChart data={data} />

      <RecentRunsTable
        runs={data.recent_runs || []}
        page={recentRunsPage}
        onPageChange={setRecentRunsPage}
        pageSize={RECENT_RUNS_PAGE_SIZE}
      />
    </div>
  );
}

export default Analytics;
