import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, FileJson, Lock, MoreHorizontal, TriangleAlert } from 'lucide-react';
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
            <Button size="sm" className="h-8 min-w-[14rem] gap-1.5" onClick={openReview} aria-live="polite">
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy customer summary'}
              {/* Tag sits on the primary button: dark text on the light button (dark mode), light on dark. */}
              <span className="ml-0.5 rounded-full bg-amber-300/20 px-1.5 py-px text-[10px] font-semibold uppercase leading-4 tracking-wide text-amber-200 ring-1 ring-inset ring-amber-300/40 dark:bg-amber-400/25 dark:text-amber-900 dark:ring-amber-600/30">
                Beta
              </span>
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl sm:rounded-xl">
          <DialogHeader className="space-y-2 px-6 pb-4 pt-6 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base">Copy customer summary</DialogTitle>
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Beta
              </span>
            </div>
            <DialogDescription asChild>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed text-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <p>
                  <span className="font-semibold">Please read it before you send it.</span> I&apos;m still testing this, so
                  let me know if anything looks off. <span className="whitespace-nowrap text-muted-foreground">— River</span>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="px-6">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">What the customer will get</p>
            <div
              // Until they confirm, the summary can be read but not selected or copied by hand.
              onCopy={(e) => !reviewed && e.preventDefault()}
              onCut={(e) => !reviewed && e.preventDefault()}
              onContextMenu={(e) => !reviewed && e.preventDefault()}
              className={cn(
                'max-h-[min(18rem,45vh)] overflow-y-auto rounded-lg border bg-muted/30 px-4 py-3 [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_transparent] [scrollbar-width:thin]',
                !reviewed && 'select-none'
              )}
            >
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">
                {customerSummary}
              </p>
            </div>
            {!reviewed && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                Tick the box below to copy the summary.
              </p>
            )}

            <label
              htmlFor="summary-reviewed"
              className={cn(
                'mt-4 flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors hover:bg-muted/50',
                reviewed && 'border-foreground/20 bg-muted/40'
              )}
            >
              <Checkbox
                id="summary-reviewed"
                checked={reviewed}
                onCheckedChange={(value) => setReviewed(value === true)}
                className="mt-0.5"
              />
              <span className={cn('leading-snug transition-colors', reviewed ? 'text-foreground' : 'text-muted-foreground')}>
                I&apos;ve read this summary and will check it before sending it to the customer.
              </span>
            </label>
          </div>

          <DialogFooter className="mt-6 gap-2 border-t bg-muted/30 px-6 py-4 sm:gap-2 sm:space-x-0">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
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
