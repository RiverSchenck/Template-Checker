import React, { useState } from 'react';
import { CircleCheck, OctagonX, FileWarning } from 'lucide-react';
import { EmptyState, formatAbsolute, formatRelative, StatusPill } from '../layout/page-kit';
import { SectionCard } from './parts';
import { formatCount, formatDuration, formatFileSize, personLabel, sourceLabel, stageLabel } from './format';
import type { Overview, RunRow } from './types';

const COLLAPSED_COUNT = 5;

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function RunStatusPill({ status }: { status: RunRow['status'] }) {
  if (status === 'failed') return <StatusPill tone="red" icon={OctagonX}>Crashed</StatusPill>;
  if (status === 'rejected') return <StatusPill tone="amber" icon={FileWarning}>Rejected</StatusPill>;
  return <StatusPill tone="neutral" icon={CircleCheck}>Completed</StatusPill>;
}

function ProblemRun({ run, onSelect }: { run: RunRow; onSelect: (run: RunRow) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(run)}
        className="block w-full px-5 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-neutral-900/60 dark:focus-visible:bg-neutral-900/60"
      >
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <RunStatusPill status={run.status} />
            <span className="truncate text-sm font-medium" title={run.template_name}>
              {run.template_name}
            </span>
          </span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={run.timestamp} title={formatAbsolute(run.timestamp)}>
            {formatRelative(run.timestamp)}
          </time>
        </span>
        <span className="mt-1.5 block truncate font-mono text-xs text-foreground" title={run.error_message ?? undefined}>
          {run.error_message || 'No error message recorded'}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {stageLabel(run.stopped_at_stage)} · {personLabel(run.display_name, run.email)} · {sourceLabel(run.source_type)} ·{' '}
          {formatFileSize(run.file_size_bytes)}
          {run.app_version ? ` · ${run.app_version}` : ''}
        </span>
      </button>
    </li>
  );
}

export function Reliability({ overview, onSelectRun }: { overview: Overview; onSelectRun: (run: RunRow) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { current, problem_runs: problems } = overview;
  const visible = expanded ? problems : problems.slice(0, COLLAPSED_COUNT);

  return (
    <SectionCard
      title="Reliability"
      description="Checks that crashed or couldn't open the upload"
      info={
        <>
          <strong>Crashed</strong>: the checker threw an error, so support got no results. <strong>Rejected</strong>: the
          upload couldn&apos;t be checked (not a ZIP, no or several IDML files, unreadable IDML); support saw why.
          Times are for completed checks only.
        </>
      }
      bodyClassName="px-0 pb-2"
    >
      <div className="grid grid-cols-2 gap-4 border-b px-5 pb-4 sm:grid-cols-4">
        <Figure label="Crashed" value={formatCount(current.failed)} hint="The checker threw an error" />
        <Figure label="Rejected" value={formatCount(current.rejected)} hint="Not a ZIP, no IDML, or unreadable" />
        <Figure label="Typical time" value={formatDuration(current.p50_duration_ms)} hint="Median duration of completed checks" />
        <Figure label="Slowest 5%" value={formatDuration(current.p95_duration_ms)} hint="95th percentile duration" />
      </div>
      {problems.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Every check completed" description="Nothing crashed or got rejected in this period." />
      ) : (
        <>
          <ul className="divide-y">
            {visible.map((run) => (
              <ProblemRun key={run.id} run={run} onSelect={onSelectRun} />
            ))}
          </ul>
          {problems.length > COLLAPSED_COUNT && (
            <div className="border-t px-5 pt-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Show fewer' : `Show ${problems.length - COLLAPSED_COUNT} more`}
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
