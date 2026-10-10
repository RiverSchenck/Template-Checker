import React from 'react';
import { ArrowRight, OctagonX, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IconChip } from '../layout/page-kit';
import { isNewIssue, shareChange } from './TopIssues';
import { formatCount, formatPercent, hasFullPreviousPeriod, lowerFirst, ratio, stageLabel } from './format';
import type { IssueSummary, Overview } from './types';

type Tone = 'red' | 'amber' | 'green' | 'violet';

interface Highlight {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  text: React.ReactNode;
  action: { label: string; onClick: () => void };
}

// Thresholds for calling something out: big enough to be worth a developer's attention.
const MIN_ISSUE_SHIFT_PTS = 0.04;
const MIN_RUNS_FOR_TRENDS = 20;
// How many rising (and, separately, falling) issues to call out.
const MAX_PER_TREND = 2;

/** The most common error among recent problem runs, with the deployment it happened on. */
function topCrash(overview: Overview) {
  const counts = new Map<string, { count: number; stage: string | null; version: string | null }>();
  for (const run of overview.problem_runs) {
    if (run.status !== 'failed' || !run.error_message) continue;
    const entry = counts.get(run.error_message) ?? { count: 0, stage: run.stopped_at_stage, version: run.app_version };
    entry.count += 1;
    counts.set(run.error_message, entry);
  }
  const [message, info] = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [];
  return message && info ? { message, ...info } : null;
}

function buildHighlights(
  overview: Overview,
  onSelectIssue: (issue: IssueSummary) => void,
  onShowFailures?: () => void
): Highlight[] {
  const { current, previous, issues } = overview;
  const comparable = hasFullPreviousPeriod(overview);
  const highlights: Highlight[] = [];

  // Crashes going up is the most urgent thing on the page. Without a full previous period to compare
  // against, call out any crash rate of 1% or more.
  const crashRate = ratio(current.failed, current.runs) ?? 0;
  const prevCrashRate = ratio(previous.failed, previous.runs) ?? 0;
  // Crashes are operational, so only shown to people who can open the crashed runs (admins).
  if (onShowFailures && current.failed > 0 && crashRate >= 0.01 && (!comparable || crashRate >= prevCrashRate * 1.5)) {
    const crash = topCrash(overview);
    highlights.push({
      key: 'crashes',
      icon: OctagonX,
      tone: 'red',
      text: (
        <>
          <strong className="font-semibold">{formatCount(current.failed)} checks crashed</strong> ({formatPercent(crashRate)}
          {comparable && `, up from ${formatPercent(prevCrashRate)}`}).
          {crash && (
            <>
              {' '}
              Most often <code className="rounded bg-neutral-100 px-1 py-px font-mono text-[12px] dark:bg-neutral-800">{crash.message}</code>{' '}
              while {lowerFirst(stageLabel(crash.stage))}
              {crash.version && <> on {crash.version}</>}.
            </>
          )}
        </>
      ),
      action: { label: 'See crashes', onClick: onShowFailures },
    });
  }

  for (const issue of issues.filter((i) => isNewIssue(i, overview)).slice(0, 2)) {
    highlights.push({
      key: `new:${issue.validation_type}`,
      icon: Sparkles,
      tone: 'violet',
      text: (
        <>
          <strong className="font-semibold">New issue: {issue.label}</strong> started showing up this period and already hits{' '}
          {formatPercent(ratio(issue.runs_affected, current.completed))} of checks.
        </>
      ),
      action: { label: 'Details', onClick: () => onSelectIssue(issue) },
    });
  }

  if (comparable && current.completed >= MIN_RUNS_FOR_TRENDS && previous.completed >= MIN_RUNS_FOR_TRENDS) {
    const moving = issues
      .filter((i) => !isNewIssue(i, overview))
      .map((issue) => ({ issue, change: shareChange(issue, overview) ?? 0 }));
    const rising = moving
      .filter((m) => m.change >= MIN_ISSUE_SHIFT_PTS)
      .sort((a, b) => b.change - a.change)
      .slice(0, MAX_PER_TREND);
    const falling = moving
      .filter((m) => m.change <= -MIN_ISSUE_SHIFT_PTS)
      .sort((a, b) => a.change - b.change)
      .slice(0, MAX_PER_TREND);
    for (const { issue, change } of rising) {
      highlights.push({
        key: `rising:${issue.validation_type}`,
        icon: TrendingUp,
        tone: 'amber',
        text: (
          <>
            <strong className="font-semibold">{issue.label}</strong> is up {Math.round(change * 100)} pts, now in{' '}
            {formatPercent(ratio(issue.runs_affected, current.completed))} of checks.
          </>
        ),
        action: { label: 'Details', onClick: () => onSelectIssue(issue) },
      });
    }
    for (const { issue, change } of falling) {
      highlights.push({
        key: `falling:${issue.validation_type}`,
        icon: TrendingDown,
        tone: 'green',
        text: (
          <>
            <strong className="font-semibold">{issue.label}</strong> is down {Math.round(Math.abs(change) * 100)} pts, now in{' '}
            {formatPercent(ratio(issue.runs_affected, current.completed))} of checks.
          </>
        ),
        action: { label: 'Details', onClick: () => onSelectIssue(issue) },
      });
    }
  }

  // Each kind is capped (crash 1, new 2, rising 2, falling 2), so the list never runs past 7.
  return highlights;
}

export function Highlights({
  overview,
  onSelectIssue,
  onShowFailures,
}: {
  overview: Overview;
  onSelectIssue: (issue: IssueSummary) => void;
  /** Omitted for non-admins, which also hides the crash highlight. */
  onShowFailures?: () => void;
}) {
  const highlights = buildHighlights(overview, onSelectIssue, onShowFailures);
  if (highlights.length === 0) return null;

  return (
    <section aria-label="Worth a look" className="mb-6 overflow-hidden rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <h2 className="border-b bg-neutral-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:bg-neutral-900/40">
        Worth a look
      </h2>
      <ul className="divide-y">
        {highlights.map((h) => (
          <li key={h.key} className="flex items-center gap-3 py-2.5 pl-3 pr-2">
            <IconChip icon={h.icon} tone={h.tone} />
            <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">{h.text}</p>
            <button
              type="button"
              onClick={h.action.onClick}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
            >
              {h.action.label}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
