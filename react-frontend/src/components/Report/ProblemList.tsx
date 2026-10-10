import React, { useState } from 'react';
import { Check, ChevronRight, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { CheckDefinition } from '../../types';
import { cn } from '../../lib/utils';
import { severityStyles } from './pages/PageCanvas';
import { describeWhere, formatPages, SEVERITIES, SEVERITY_INFO, type Problem, type ReportComparison, type Subject } from './buildReport';
import { getCheckGuide } from './checkGuide';

type ProblemListProps = {
  problems: Problem[];
  selectedId: string | null;
  selectedPlaceKey: string | null;
  onSelectProblem: (id: string | null) => void;
  onSelectPlace: (problemId: string, placeKey: string) => void;
  comparison: ReportComparison | null;
  passedChecks: CheckDefinition[];
  checked: { label: string; count: number }[];
};

const MAX_SUBJECTS = 5;

function ChangeBadge({ change }: { change?: ReportComparison['byId'][string] }) {
  if (!change || change.status === 'same') return null;
  const styles = {
    new: 'bg-destructive/10 text-destructive',
    better: 'bg-green-600/10 text-green-700 dark:text-green-400',
    worse: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  }[change.status];
  return (
    <span className={cn('rounded px-1.5 py-px text-[10px] font-medium', styles)}>
      {change.status === 'new' ? 'New' : `was ${change.before}`}
    </span>
  );
}

function SubjectRow({
  subject,
  active,
  onSelect,
}: {
  subject: Subject;
  active: boolean;
  onSelect: (() => void) | null;
}) {
  const place = subject.places[0];
  const pages = Array.from(new Set(subject.places.map((p) => p.pageName).filter(Boolean))) as string[];
  const isFrame = subject.kind === 'frame';
  const title = isFrame ? place.frameText ?? place.frameLabel : subject.label;
  const pageText = pages.length ? formatPages(pages) : '';
  const extra = isFrame ? place.context : subject.places.length > 1 ? `${subject.places.length} frames` : '';

  const content = (
    <>
      <span
        className={cn(
          'flex h-5 min-w-[2.25rem] shrink-0 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums',
          pageText ? 'bg-muted text-muted-foreground' : 'text-muted-foreground'
        )}
        title={pageText ? `Page ${pageText}` : 'Not on a page'}
      >
        {pageText ? `p${pageText}` : '–'}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{title}</span>
      {extra && <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{extra}</span>}
    </>
  );

  const base = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left';
  return onSelect ? (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        base,
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_15%,transparent)]' : 'hover:bg-muted'
      )}
    >
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}

function ProblemDetails({
  problem,
  selectedPlaceKey,
  onSelectPlace,
}: {
  problem: Problem;
  selectedPlaceKey: string | null;
  onSelectPlace: (placeKey: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const subjects = showAll ? problem.subjects : problem.subjects.slice(0, MAX_SUBJECTS);
  const ids = Array.from(
    new Set(problem.subjects.flatMap((s) => s.places.map((p) => p.item.data_id)).filter((id) => id && id !== 'null'))
  );

  return (
    <div className="flex flex-col gap-4 pb-4 pl-[2.125rem] pr-4">
      {problem.guide.fix.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">How to fix</p>
          <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-snug text-foreground marker:text-muted-foreground">
            {problem.guide.fix.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {problem.subjects[0]?.kind !== 'document' || problem.subjects.length > 1 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Where</p>
          <div className="-mx-2 flex flex-col gap-0.5">
            {subjects.map((subject) => {
              const target = subject.places.find((p) => p.bounds);
              return (
                <SubjectRow
                  key={subject.key}
                  subject={subject}
                  active={subject.places.some((p) => p.key === selectedPlaceKey)}
                  onSelect={target ? () => onSelectPlace(target.key) : null}
                />
              );
            })}
          </div>
          {problem.subjects.length > MAX_SUBJECTS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {showAll ? 'Show fewer' : `Show all ${problem.subjects.length}`}
            </button>
          )}
        </div>
      ) : (
        problem.subjects[0]?.places[0]?.context && (
          <p className="text-sm text-muted-foreground">{problem.subjects[0].places[0].context}</p>
        )
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {problem.helpArticle && (
          <a
            href={problem.helpArticle}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
          >
            Help article
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          className="underline-offset-2 hover:text-foreground hover:underline"
          aria-expanded={showTech}
        >
          {showTech ? 'Hide details' : 'Details'}
        </button>
      </div>

      {showTech && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border border-border bg-background px-3 py-2 text-xs">
          <dt className="text-muted-foreground">Check</dt>
          <dd className="font-mono">{problem.key}</dd>
          {problem.guide.why && (
            <>
              <dt className="text-muted-foreground">Why</dt>
              <dd>{problem.guide.why}</dd>
            </>
          )}
          {problem.message && (
            <>
              <dt className="text-muted-foreground">Checker</dt>
              <dd>{problem.message}</dd>
            </>
          )}
          {ids.length > 0 && (
            <>
              <dt className="text-muted-foreground">Frame ids</dt>
              <dd className="break-words font-mono">{ids.join(', ')}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function ProblemList({
  problems,
  selectedId,
  selectedPlaceKey,
  onSelectProblem,
  onSelectPlace,
  comparison,
  passedChecks,
  checked,
}: ProblemListProps) {
  const [passedOpen, setPassedOpen] = useState(false);
  // Several checks share a plain-language title (e.g. image vs. frame flips).
  const passedTitles = Array.from(
    new Set(passedChecks.map((c) => getCheckGuide(c.severity, c.key, c.label, c.message).title))
  );

  const total = problems.length;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium text-foreground">Issues</h2>
        <span className="text-xs text-muted-foreground">{total === 1 ? '1 problem' : `${total} problems`}</span>
      </div>

      {SEVERITIES.map((severity) => {
        const items = problems.filter((p) => p.severity === severity);
        if (!items.length) return null;
        return (
          <section key={severity} id={`report-section-${severity}`} className="scroll-mt-4">
            <h3 className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--muted)_50%,transparent)] px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', severityStyles[severity].dot)} aria-hidden />
                {SEVERITY_INFO[severity].title}
              </span>
              <span className="tabular-nums">{items.length}</span>
            </h3>
            <ul className="divide-y divide-border border-b border-border">
              {items.map((problem) => {
                const open = problem.id === selectedId;
                return (
                  <li key={problem.id} className={cn(open && 'bg-[color-mix(in_oklab,var(--muted)_40%,transparent)] shadow-[inset_2px_0_0_var(--foreground)]')}>
                    <button
                      type="button"
                      onClick={() => onSelectProblem(open ? null : problem.id)}
                      aria-expanded={open}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        !open && 'hover:bg-[color-mix(in_oklab,var(--muted)_40%,transparent)]'
                      )}
                    >
                      <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', severityStyles[problem.severity].dot)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{problem.guide.title}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{problem.placeCount}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{describeWhere(problem)}</span>
                          <ChangeBadge change={comparison?.byId[problem.id]} />
                        </span>
                      </span>
                    </button>
                    {open && (
                      <ProblemDetails
                        problem={problem}
                        selectedPlaceKey={selectedPlaceKey}
                        onSelectPlace={(placeKey) => onSelectPlace(problem.id, placeKey)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {(passedTitles.length > 0 || checked.length > 0) && (
        <Collapsible open={passedOpen} onOpenChange={setPassedOpen}>
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs text-muted-foreground hover:bg-[color-mix(in_oklab,var(--muted)_40%,transparent)]">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />
              {passedTitles.length} checks passed
            </span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t border-border px-4 py-2">
              {passedTitles.map((title) => (
                <li key={title} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 shrink-0 text-green-600/70 dark:text-green-400/70" aria-hidden />
                  {title}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default ProblemList;
