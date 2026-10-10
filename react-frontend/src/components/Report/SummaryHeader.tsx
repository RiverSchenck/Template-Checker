import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, FileJson, MoreHorizontal } from 'lucide-react';
import { notify } from '../../lib/notify';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ValidationType } from '../../types';
import { cn } from '../../lib/utils';
import { severityStyles } from './pages/PageCanvas';
import { SEVERITIES, SEVERITY_INFO, type Report } from './buildReport';
import { displayTemplateName } from './customerSummary';

type SummaryHeaderProps = {
  report: Report;
  templateName: string;
  pageCount: number;
  /** Counts from the previous upload, when comparing. */
  previousCounts: Record<ValidationType, number> | null;
  onJumpTo: (severity: ValidationType) => void;
  /** Message for the customer: what may be causing their issues and how to fix it. */
  customerSummary: string;
  /** Raw checker response, downloadable for deeper debugging. */
  rawResult: unknown;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Delta({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (diff === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  const better = diff < 0;
  const Icon = better ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        better ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(diff)} vs last upload
    </span>
  );
}

function SummaryHeader({
  report,
  templateName,
  pageCount,
  previousCounts,
  onJumpTo,
  customerSummary,
  rawResult,
}: SummaryHeaderProps) {
  const name = displayTemplateName(templateName) || 'Untitled template';
  const extension = templateName.slice(displayTemplateName(templateName).length).replace('.', '').toUpperCase();
  const meta = [
    extension || null,
    pageCount ? plural(pageCount, 'page') : null,
    report.checked.length ? `${report.checked.map((c) => `${c.count} ${c.label}`).join(', ')} checked` : null,
  ].filter(Boolean);

  // The summary is in beta: agents review it in a dialog and confirm before it's copied.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const openReview = () => {
    setReviewed(false);
    setReviewOpen(true);
  };
  // The button itself confirms the copy; only a failure needs a toast.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(customerSummary);
      setCopied(true);
      setReviewOpen(false);
    } catch {
      notify.error('Couldn’t copy the summary. Try again, or select the text and copy it manually.');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(rawResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[^\w.-]+/g, '_')}-check.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-7 text-foreground" title={templateName}>
            {name}
          </h1>
          {meta.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(' · ')}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={downloadJson} className="gap-2">
                  <FileJson className="h-4 w-4" aria-hidden />
                  Download raw JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="h-8 min-w-[11.5rem] gap-1.5" onClick={openReview} aria-live="polite">
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy customer summary'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
        {SEVERITIES.map((severity, i) => {
          const places = report.placeCounts[severity];
          const problems = report.problemCounts[severity];
          const empty = places === 0;
          return (
            <Tooltip key={severity}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => !empty && onJumpTo(severity)}
                  aria-disabled={empty}
                  className={cn(
                    'flex flex-col gap-1 px-4 py-3 text-left transition-colors focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    i > 0 && 'border-t border-border sm:border-l sm:border-t-0',
                    empty ? 'cursor-default' : 'hover:bg-[color-mix(in_oklab,var(--muted)_50%,transparent)]'
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', empty ? 'bg-muted-foreground' : severityStyles[severity].dot)}
                        aria-hidden
                      />
                      {SEVERITY_INFO[severity].title}
                    </span>
                    {previousCounts && <Delta now={places} before={previousCounts[severity]} />}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className={cn('text-xl font-semibold tabular-nums leading-7', empty ? 'text-muted-foreground' : 'text-foreground')}>
                      {places}
                    </span>
                    {!empty && <span className="text-xs text-muted-foreground">in {plural(problems, 'problem')}</span>}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {SEVERITY_INFO[severity].description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer summary (beta)</DialogTitle>
            <DialogDescription>
              Please read the summary before you send it. I&apos;m still testing this, so let me know if anything looks
              off. — River
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-sans text-sm leading-relaxed text-foreground">
            {customerSummary}
          </pre>
          <label htmlFor="summary-reviewed" className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              id="summary-reviewed"
              checked={reviewed}
              onCheckedChange={(value) => setReviewed(value === true)}
              className="mt-0.5"
            />
            <span>I&apos;ve read this summary and will check it before sending it to the customer.</span>
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={copySummary} disabled={!reviewed} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export default SummaryHeader;
