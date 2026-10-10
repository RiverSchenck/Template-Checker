import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, History } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../../lib/utils';
import type { ProblemChange, ReportComparison } from './buildReport';

type ChangesPanelProps = {
  comparison: ReportComparison;
  previousName: string;
};

const MAX_SUBJECTS = 3;

function subjects(labels: string[]) {
  if (!labels.length) return null;
  const shown = labels.slice(0, MAX_SUBJECTS).join(', ');
  return labels.length > MAX_SUBJECTS ? `${shown} and ${labels.length - MAX_SUBJECTS} more` : shown;
}

function ChangeRow({ change, kind }: { change: ProblemChange; kind: 'fixed' | 'added' | 'better' | 'worse' }) {
  const detail =
    kind === 'fixed'
      ? subjects(change.fixedSubjects)
      : kind === 'added'
        ? subjects(change.newSubjects)
        : [
            change.fixedSubjects.length ? `fixed ${subjects(change.fixedSubjects)}` : null,
            change.newSubjects.length ? `new in ${subjects(change.newSubjects)}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
  return (
    <li className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className={cn('text-sm', kind === 'fixed' ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>
          {change.title}
          {change.severity !== 'errors' && (
            <span className="ml-1.5 text-xs text-muted-foreground no-underline">({change.severity === 'warnings' ? 'warning' : 'info'})</span>
          )}
        </p>
        {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {change.before} → {change.after}
      </span>
    </li>
  );
}

const GROUPS: { kind: 'fixed' | 'added' | 'better' | 'worse'; title: string; dot: string }[] = [
  { kind: 'fixed', title: 'Fixed', dot: 'bg-green-600' },
  { kind: 'added', title: 'New', dot: 'bg-destructive' },
  { kind: 'better', title: 'Fewer places', dot: 'bg-green-600/60' },
  { kind: 'worse', title: 'More places', dot: 'bg-amber-500' },
];

/** What changed compared with the previous upload, for checking a customer's fixes. */
function ChangesPanel({ comparison, previousName }: ChangesPanelProps) {
  const lists = { fixed: comparison.fixed, added: comparison.added, better: comparison.better, worse: comparison.worse };
  const anyChange = GROUPS.some(({ kind }) => lists[kind].length > 0);
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          Since the last upload
        </span>
        <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {!anyChange && <span>Nothing changed</span>}
          {comparison.fixed.length > 0 && (
            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
              <ArrowDown className="h-3 w-3" aria-hidden />
              {comparison.fixed.length} fixed
            </span>
          )}
          {comparison.added.length > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ArrowUp className="h-3 w-3" aria-hidden />
              {comparison.added.length} new
            </span>
          )}
          {comparison.better.length > 0 && <span>{comparison.better.length} improved</span>}
          {comparison.worse.length > 0 && <span>{comparison.worse.length} got worse</span>}
          {comparison.unchanged > 0 && <span>{comparison.unchanged} unchanged</span>}
        </span>
        <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">vs {previousName}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-x-8 border-t border-border px-4 pb-2 pt-1 md:grid-cols-2">
          {GROUPS.filter(({ kind }) => lists[kind].length > 0).map(({ kind, title, dot }) => (
            <section key={kind} className="pt-2">
              <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
                {title}
              </h4>
              <ul className="divide-y divide-border">
                {lists[kind].map((change) => (
                  <ChangeRow key={change.id} change={change} kind={kind} />
                ))}
              </ul>
            </section>
          ))}
          {!anyChange && <p className="py-3 text-sm text-muted-foreground">The same problems were found in both uploads.</p>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default ChangesPanel;
