import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PeriodSelection, RunFilters, RunStatus, SourceType } from './types';

/**
 * Everything that shapes the analytics pages lives in the URL, so a link reproduces exactly what you see:
 *   ?range=7|30|90|365  or  ?start=YYYY-MM-DD&end=YYYY-MM-DD
 *   &status= &source= &agent=<user id> &has=<validation type> &q=<template search>   (the checks table)
 *   &issue=<validation type>                                                        (the open issue panel)
 */

export const PRESET_DAYS = [7, 30, 90, 365] as const;
const DEFAULT_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: RunStatus[] = ['completed', 'rejected', 'failed'];
const SOURCES: SourceType[] = ['react-frontend', 'extension', 'api'];

const FILTER_KEYS = ['status', 'source', 'agent', 'has', 'q'] as const;
const PERIOD_KEYS = ['range', 'start', 'end'] as const;

/** The period part of the query string (`?range=90`, or empty), so links between analytics pages keep the dates. */
export function periodSearch(params: URLSearchParams): string {
  const kept = new URLSearchParams();
  PERIOD_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) kept.set(k, v);
  });
  const search = kept.toString();
  return search ? `?${search}` : '';
}

/** Replace the checks-table filters in `params`. */
export function writeFilters(params: URLSearchParams, f: RunFilters) {
  FILTER_KEYS.forEach((k) => params.delete(k));
  if (f.status) params.set('status', f.status);
  if (f.source) params.set('source', f.source);
  if (f.userId) params.set('agent', f.userId);
  if (f.validationType) params.set('has', f.validationType);
  if (f.search?.trim()) params.set('q', f.search.trim());
}

function readPeriod(params: URLSearchParams): PeriodSelection {
  const start = params.get('start');
  const end = params.get('end');
  if (start && end && DATE_RE.test(start) && DATE_RE.test(end) && start <= end) {
    return { kind: 'custom', start, end };
  }
  const days = Number(params.get('range'));
  return { kind: 'preset', days: (PRESET_DAYS as readonly number[]).includes(days) ? days : DEFAULT_DAYS };
}

function readFilters(params: URLSearchParams): RunFilters {
  const status = params.get('status') as RunStatus | null;
  const source = params.get('source') as SourceType | null;
  return {
    status: status && STATUSES.includes(status) ? status : undefined,
    source: source && SOURCES.includes(source) ? source : undefined,
    userId: params.get('agent') || undefined,
    validationType: params.get('has') || undefined,
    search: params.get('q') || undefined,
  };
}

export function useAnalyticsUrlState() {
  const [params, setParams] = useSearchParams();

  const period = useMemo(() => readPeriod(params), [params]);
  const filters = useMemo(() => readFilters(params), [params]);
  const issue = params.get('issue');

  const update = useCallback(
    (change: (next: URLSearchParams) => void) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          change(next);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setPeriod = useCallback(
    (p: PeriodSelection) =>
      update((next) => {
        next.delete('range');
        next.delete('start');
        next.delete('end');
        if (p.kind === 'custom') {
          next.set('start', p.start);
          next.set('end', p.end);
        } else if (p.days !== DEFAULT_DAYS) {
          next.set('range', String(p.days));
        }
      }),
    [update]
  );

  const setFilters = useCallback((f: RunFilters) => update((next) => writeFilters(next, f)), [update]);

  const setIssue = useCallback(
    (validationType: string | null) =>
      update((next) => {
        if (validationType) next.set('issue', validationType);
        else next.delete('issue');
      }),
    [update]
  );

  return { params, period, setPeriod, filters, setFilters, issue, setIssue };
}
