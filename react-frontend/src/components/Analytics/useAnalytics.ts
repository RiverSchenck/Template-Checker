import { useState, useEffect, useMemo } from 'react';
import type { AnalyticsSummary } from './types';
import { baseURL, getAuthHeaders } from './api';
import { MAX_ANALYTICS_DAYS } from './constants';

export function useAnalytics(): {
  loading: boolean;
  error: string | null;
  data: AnalyticsSummary | null;
  days: number;
  setDays: (d: number) => void;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullData, setFullData] = useState<AnalyticsSummary | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${baseURL}/analytics/summary?days=${MAX_ANALYTICS_DAYS}`,
          { method: 'GET', headers: getAuthHeaders() }
        );
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        setFullData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const data = useMemo(() => {
    if (!fullData) return null;
    const runsOverTimeAll = fullData.runs_over_time || [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const runsOverTimeFiltered = runsOverTimeAll.filter((d: { date: string }) => d.date >= cutoffStr);
    const summary = {
      ...fullData.summary,
      total_runs: runsOverTimeFiltered.reduce((a: number, d: { runs: number }) => a + d.runs, 0),
      total_errors: runsOverTimeFiltered.reduce((a: number, d: { errors: number }) => a + d.errors, 0),
      total_warnings: runsOverTimeFiltered.reduce((a: number, d: { warnings: number }) => a + d.warnings, 0),
      total_infos: runsOverTimeFiltered.reduce((a: number, d: { infos: number }) => a + d.infos, 0),
      days,
    };
    type RunRow = { date: string; runs: number; errors: number; warnings: number; infos: number; react_frontend?: number; extension?: number; api?: number };
    const rf = (runsOverTimeFiltered as RunRow[]).reduce((a, d) => a + (d.react_frontend ?? 0), 0);
    const ext = (runsOverTimeFiltered as RunRow[]).reduce((a, d) => a + (d.extension ?? 0), 0);
    const apiCount = (runsOverTimeFiltered as RunRow[]).reduce((a, d) => a + (d.api ?? 0), 0);
    const sourceTypes: AnalyticsSummary['source_types'] = {
      'react-frontend': {
        count: rf,
        total_errors: fullData.source_types?.['react-frontend']?.total_errors ?? 0,
        total_warnings: fullData.source_types?.['react-frontend']?.total_warnings ?? 0,
        total_infos: fullData.source_types?.['react-frontend']?.total_infos ?? 0,
      },
      extension: {
        count: ext,
        total_errors: fullData.source_types?.extension?.total_errors ?? 0,
        total_warnings: fullData.source_types?.extension?.total_warnings ?? 0,
        total_infos: fullData.source_types?.extension?.total_infos ?? 0,
      },
      api: {
        count: apiCount,
        total_errors: fullData.source_types?.api?.total_errors ?? 0,
        total_warnings: fullData.source_types?.api?.total_warnings ?? 0,
        total_infos: fullData.source_types?.api?.total_infos ?? 0,
      },
    };
    const recentRuns = (fullData.recent_runs || []).filter((r: { timestamp?: string }) => {
      if (!r.timestamp) return false;
      return r.timestamp.slice(0, 10) >= cutoffStr;
    });
    const errorsPerRunByDayAll = fullData.errors_per_run_by_day || [];
    const errorsPerRunByDayFiltered = errorsPerRunByDayAll.filter(
      (d: { date: string }) => d.date >= cutoffStr
    );
    const errorsHistogram = errorsPerRunByDayFiltered.reduce(
      (acc, d) => ({
        errors_0: acc.errors_0 + (d.errors_0 ?? 0),
        errors_1_5: acc.errors_1_5 + (d.errors_1_5 ?? 0),
        errors_6_10: acc.errors_6_10 + (d.errors_6_10 ?? 0),
        errors_11_15: acc.errors_11_15 + (d.errors_11_15 ?? 0),
        errors_16_plus: acc.errors_16_plus + (d.errors_16_plus ?? 0),
      }),
      { errors_0: 0, errors_1_5: 0, errors_6_10: 0, errors_11_15: 0, errors_16_plus: 0 }
    );
    const warningsPerRunByDayAll = fullData.warnings_per_run_by_day || [];
    const warningsPerRunByDayFiltered = warningsPerRunByDayAll.filter(
      (d: { date: string }) => d.date >= cutoffStr
    );
    const warningsHistogram = warningsPerRunByDayFiltered.reduce(
      (acc, d) => ({
        warnings_0: acc.warnings_0 + (d.warnings_0 ?? 0),
        warnings_1_5: acc.warnings_1_5 + (d.warnings_1_5 ?? 0),
        warnings_6_10: acc.warnings_6_10 + (d.warnings_6_10 ?? 0),
        warnings_11_15: acc.warnings_11_15 + (d.warnings_11_15 ?? 0),
        warnings_16_plus: acc.warnings_16_plus + (d.warnings_16_plus ?? 0),
      }),
      { warnings_0: 0, warnings_1_5: 0, warnings_6_10: 0, warnings_11_15: 0, warnings_16_plus: 0 }
    );
    const infosPerRunByDayAll = fullData.infos_per_run_by_day || [];
    const infosPerRunByDayFiltered = infosPerRunByDayAll.filter(
      (d: { date: string }) => d.date >= cutoffStr
    );
    const infosHistogram = infosPerRunByDayFiltered.reduce(
      (acc, d) => ({
        infos_0: acc.infos_0 + (d.infos_0 ?? 0),
        infos_1_5: acc.infos_1_5 + (d.infos_1_5 ?? 0),
        infos_6_10: acc.infos_6_10 + (d.infos_6_10 ?? 0),
        infos_11_15: acc.infos_11_15 + (d.infos_11_15 ?? 0),
        infos_16_plus: acc.infos_16_plus + (d.infos_16_plus ?? 0),
      }),
      { infos_0: 0, infos_1_5: 0, infos_6_10: 0, infos_11_15: 0, infos_16_plus: 0 }
    );
    return {
      summary,
      source_types: sourceTypes,
      all_validations: fullData.all_validations,
      runs_over_time: runsOverTimeFiltered,
      errors_per_run_by_day: errorsPerRunByDayFiltered,
      errorsHistogram,
      warningsHistogram,
      infosHistogram,
      recent_runs: recentRuns,
    } as AnalyticsSummary;
  }, [fullData, days]);

  return { loading, error, data, days, setDays };
}
