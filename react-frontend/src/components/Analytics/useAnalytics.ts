import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { fetchAnalytics } from './api';
import type { IssueDetail, Overview, PeriodSelection, RunFilters, RunsPage } from './types';

interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Query parameters for a period: ?days=N or ?start=&end=. */
export function periodParams(period: PeriodSelection): Record<string, string | number> {
  return period.kind === 'preset' ? { days: period.days } : { start: period.start, end: period.end };
}

/** The filters as /analytics/runs and /analytics/runs.csv take them. */
export function runFilterParams(filters: RunFilters): Record<string, string | undefined> {
  return {
    status: filters.status,
    source: filters.source,
    user_id: filters.userId,
    validation_type: filters.validationType,
    q: filters.search?.trim() || undefined,
  };
}

/**
 * Load an analytics endpoint whenever its params (or `refresh`) change. Keeps showing the previous data while
 * the next request is in flight (so switching ranges doesn't flash skeletons), and ignores stale responses.
 */
function useAnalyticsRequest<T>(
  path: string | null,
  params: Record<string, string | number | undefined>,
  refresh: number
): Loadable<T> {
  const { session } = useAuth();
  const token = session?.access_token;
  const [state, setState] = useState<Loadable<T>>({ data: null, loading: Boolean(path), error: null });
  const key = `${path}:${JSON.stringify(params)}:${refresh}`;

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchAnalytics<T>(path, params, token, controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Failed to load analytics' }));
      });
    return () => controller.abort();
    // `key` captures path + params + refresh; params is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);

  return state;
}

export function useOverview(period: PeriodSelection, refresh: number) {
  return useAnalyticsRequest<Overview>('overview', periodParams(period), refresh);
}

export function useIssueDetail(validationType: string | null, period: PeriodSelection, refresh: number) {
  const path = validationType ? `issues/${encodeURIComponent(validationType)}` : null;
  return useAnalyticsRequest<IssueDetail>(path, periodParams(period), refresh);
}

export function useRuns(period: PeriodSelection, filters: RunFilters, page: number, pageSize: number, refresh: number) {
  return useAnalyticsRequest<RunsPage>(
    'runs',
    { ...periodParams(period), ...runFilterParams(filters), limit: pageSize, offset: page * pageSize },
    refresh
  );
}
