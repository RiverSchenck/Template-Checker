import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileSearch, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  EmptyState,
  formatAbsolute,
  formatRelative,
  Panel,
  RowSkeleton,
  SearchField,
  secondaryActionClass,
  Segmented,
  Spinner,
} from '../layout/page-kit';
import { useAuth } from '../AuthContext';
import { downloadAnalyticsCsv } from './api';
import { RunStatusPill } from './Reliability';
import { ErrorNote } from './parts';
import { formatCount, formatDuration, personLabel, SOURCE_LABELS, sourceLabel, stageLabel } from './format';
import { periodParams, runFilterParams, useRuns } from './useAnalytics';
import type { PeriodSelection, RunFilters, RunRow, RunStatus, SourceType } from './types';

const PAGE_SIZE = 25;
type StatusFilter = 'all' | RunStatus;

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border bg-background pl-2.5 pr-1 text-xs font-medium shadow-sm">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Remove filter ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function Findings({ run }: { run: RunRow }) {
  if (run.status !== 'completed') {
    return <RunStatusPill status={run.status} />;
  }
  const errors = run.total_errors ?? 0;
  const warnings = run.total_warnings ?? 0;
  if (errors === 0 && warnings === 0) {
    return <span className="text-xs text-muted-foreground">No issues</span>;
  }
  return (
    <span className="inline-flex items-center gap-3 text-xs tabular-nums">
      <span className={cn(errors ? 'text-foreground' : 'text-muted-foreground')}>
        <span className="font-semibold">{formatCount(errors)}</span> blocker{errors === 1 ? '' : 's'}
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium">{formatCount(warnings)}</span> warning{warnings === 1 ? '' : 's'}
      </span>
    </span>
  );
}

function ExportButton({ period, filters }: { period: PeriodSelection; filters: RunFilters }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('h-9', secondaryActionClass)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { total, exported } = await downloadAnalyticsCsv(
            'runs.csv',
            { ...periodParams(period), ...runFilterParams(filters) },
            session?.access_token
          );
          if (exported < total) {
            toast.warning(`Exported the newest ${formatCount(exported)} of ${formatCount(total)} checks`, {
              description: 'Narrow the date range or filters to export the rest.',
            });
          } else {
            toast.success(`Exported ${formatCount(exported)} check${exported === 1 ? '' : 's'}`);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Export failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Download className="h-3.5 w-3.5" aria-hidden />}
      Export CSV
    </Button>
  );
}

export function RunsTable({
  period,
  filters,
  onFiltersChange,
  labels,
  refresh,
  onSelectRun,
}: {
  period: PeriodSelection;
  filters: RunFilters;
  onFiltersChange: (filters: RunFilters) => void;
  /** Display names for the issue / agent filter chips. */
  labels: { issue?: string; agent?: string };
  refresh: number;
  onSelectRun: (run: RunRow) => void;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(filters.search ?? '');
  const { data, loading, error } = useRuns(period, filters, page, PAGE_SIZE, refresh);

  // Any filter or range change starts over at the first page.
  const filterKey = JSON.stringify({ period, filters });
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      setPage(0);
    }
  }, [filterKey]);

  // Follow the URL when the search changes elsewhere (e.g. "All checks of this template").
  useEffect(() => setSearch(filters.search ?? ''), [filters.search]);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    if ((filters.search ?? '') === search) return;
    const t = setTimeout(() => onFiltersChange({ ...filters, search: search || undefined }), 300);
    return () => clearTimeout(t);
  }, [search, filters, onFiltersChange]);

  const total = data?.total ?? 0;
  const runs = data?.runs ?? [];
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const hasChips = Boolean(filters.validationType || filters.userId);

  return (
    <Panel
      toolbar={
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchField value={search} onChange={setSearch} placeholder="Search template names" />
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<StatusFilter>
                ariaLabel="Result"
                value={filters.status ?? 'all'}
                onChange={(v) => onFiltersChange({ ...filters, status: v === 'all' ? undefined : v })}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'failed', label: 'Crashed' },
                ]}
              />
              <Select
                value={filters.source ?? 'all'}
                onValueChange={(v) => onFiltersChange({ ...filters, source: v === 'all' ? undefined : (v as SourceType) })}
              >
                <SelectTrigger className="h-9 w-[130px] rounded-lg text-xs" aria-label="Source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ExportButton period={period} filters={filters} />
            </div>
          </div>
          {hasChips && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.validationType && (
                <FilterChip
                  label={`Issue: ${labels.issue ?? filters.validationType}`}
                  onRemove={() => onFiltersChange({ ...filters, validationType: undefined })}
                />
              )}
              {filters.userId && (
                <FilterChip
                  label={`Agent: ${labels.agent ?? 'Selected agent'}`}
                  onRemove={() => onFiltersChange({ ...filters, userId: undefined })}
                />
              )}
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="tabular-nums" aria-live="polite">
            {total === 0 ? 'No checks' : `${formatCount(from)}–${formatCount(to)} of ${formatCount(total)} checks`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <div className="p-4">
          <ErrorNote message={error} />
        </div>
      )}
      {loading && !data ? (
        <RowSkeleton rows={6} />
      ) : runs.length === 0 && !error ? (
        <EmptyState icon={FileSearch} title="No checks match" description="Try a different search or remove a filter." />
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-4 text-xs">Template</TableHead>
                <TableHead className="h-9 text-xs">Agent</TableHead>
                <TableHead className="h-9 text-xs">Source</TableHead>
                <TableHead className="h-9 text-xs">Result</TableHead>
                <TableHead className="h-9 text-right text-xs">Time</TableHead>
                <TableHead className="h-9 pr-4 text-right text-xs">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow
                  key={run.id}
                  tabIndex={0}
                  onClick={() => onSelectRun(run)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectRun(run);
                    }
                  }}
                  className="cursor-pointer focus-visible:bg-neutral-50 focus-visible:outline-none dark:focus-visible:bg-neutral-900/60"
                  aria-label={`Check of ${run.template_name}, open details`}
                >
                  <TableCell className="max-w-[280px] py-2.5 pl-4">
                    <p className="truncate text-sm font-medium" title={run.template_name}>
                      {run.template_name}
                    </p>
                    {run.status !== 'completed' && (
                      <p className="truncate text-xs text-muted-foreground" title={run.error_message ?? undefined}>
                        {stageLabel(run.stopped_at_stage)}: {run.error_message || 'no message'}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate py-2.5 text-sm">{personLabel(run.display_name, run.email)}</TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground">{sourceLabel(run.source_type)}</TableCell>
                  <TableCell className="py-2.5">
                    <Findings run={run} />
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm tabular-nums text-muted-foreground">
                    {formatDuration(run.duration_ms)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-2.5 pr-4 text-right text-sm text-muted-foreground" title={formatAbsolute(run.timestamp)}>
                    {formatRelative(run.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
