import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '../../types';
import SummaryHeader from './SummaryHeader';
import ChangesPanel from './ChangesPanel';
import ProblemList from './ProblemList';
import PageViewer from './PageViewer';
import { buildReport, compareReports, type Problem } from './buildReport';
import { buildCustomerSummaryDocument } from './customerSummary';
import { SummaryReview, SummaryReviewBar, type DraftComment } from './SummaryReview';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { notify } from '../../lib/notify';
import { cn } from '../../lib/utils';

type ReportViewProps = {
  result: ValidationResult;
  previous?: ValidationResult | null;
};

const firstPageOf = (problem: Problem) =>
  problem.subjects.flatMap((s) => s.places).find((p) => p.bounds)?.bounds?.page_id ?? null;

/** Results for the support team: the page with its issues, and what to tell the customer. */
function ReportView({ result, previous }: ReportViewProps) {
  const report = useMemo(() => buildReport(result), [result]);
  const previousReport = useMemo(() => (previous ? buildReport(previous) : null), [previous]);
  const comparison = useMemo(() => (previousReport ? compareReports(previousReport, report) : null), [previousReport, report]);
  const templateName = result.template_name || 'Untitled template';
  const summaryDoc = useMemo(() => buildCustomerSummaryDocument(report, templateName), [report, templateName]);
  const pageLayouts = result.page_layouts ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(() => {
    // Open on the first page that has something on it.
    for (const problem of report.problems) {
      const page = firstPageOf(problem);
      if (page) return page;
    }
    return pageLayouts[0]?.page_id ?? null;
  });

  const selected = report.problems.find((p) => p.id === selectedId) ?? null;

  // Reviewing the customer summary (beta): a pane under the results, which can be minimized to a bar.
  const [review, setReview] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [drafts, setDrafts] = useState<DraftComment[]>([]);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const reviewPanel = useRef<ImperativePanelHandle>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitHeight, setSplitHeight] = useState<number | null>(null);
  const reviewing = review !== 'closed';

  // A new upload means a new summary: start its review fresh.
  useEffect(() => {
    setDrafts([]);
    setReview('closed');
  }, [summaryDoc.text]);

  useEffect(() => {
    if (!summaryCopied) return;
    const t = setTimeout(() => setSummaryCopied(false), 2000);
    return () => clearTimeout(t);
  }, [summaryCopied]);

  // The split view fills the rest of the window, so the results and the review scroll on their own.
  useLayoutEffect(() => {
    if (!reviewing) return;
    const measure = () => {
      const top = splitRef.current?.getBoundingClientRect().top ?? 0;
      setSplitHeight(Math.max(360, window.innerHeight - top - 8));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [reviewing]);

  // The panel remembers its size; make sure it opens expanded even if it was last left collapsed.
  useEffect(() => {
    if (review === 'open' && reviewPanel.current?.isCollapsed()) reviewPanel.current.expand();
  }, [review]);

  const openReview = () => {
    if (!reviewing) window.scrollTo({ top: 0 });
    setReview('open');
  };

  const handleCopied = (commentCount: number) => {
    setReview('closed');
    setDrafts([]);
    setSummaryCopied(true);
    // Feedback goes somewhere they can't see, so confirm it; the copy itself shows on the button.
    if (commentCount > 0) notify.success('Summary copied. Your feedback was sent to River. Thanks!');
  };

  const selectProblem = (id: string | null) => {
    setSelectedId(id);
    setSelectedPlaceKey(null);
    const problem = report.problems.find((p) => p.id === id);
    if (!problem) return;
    const onCurrentPage = problem.subjects.some((s) => s.places.some((p) => p.bounds?.page_id === pageId));
    const first = firstPageOf(problem);
    if (!onCurrentPage && first) setPageId(first);
  };

  const selectPlace = (problemId: string, placeKey: string | null) => {
    setSelectedId(problemId);
    setSelectedPlaceKey(placeKey);
    const place = report.problems
      .find((p) => p.id === problemId)
      ?.subjects.flatMap((s) => s.places)
      .find((p) => p.key === placeKey);
    if (place?.bounds) setPageId(place.bounds.page_id);
  };

  const content = (
    <div className="flex flex-col gap-4 pb-10 pt-2">
      <SummaryHeader
        report={report}
        templateName={templateName}
        pageCount={pageLayouts.length}
        previousCounts={previousReport?.placeCounts ?? null}
        onJumpTo={(severity) =>
          document.getElementById(`report-section-${severity}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        onReviewSummary={openReview}
        summaryCopied={summaryCopied}
        rawResult={result}
      />

      {comparison && previous && (
        <ChangesPanel comparison={comparison} previousName={previous.template_name || 'previous upload'} />
      )}

      {report.problems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden />
          <p className="text-sm font-medium text-foreground">Every check passed</p>
          {report.checked.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Checked {report.checked.map((c) => `${c.count} ${c.label}`).join(', ')}.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <ProblemList
              problems={report.problems}
              selectedId={selectedId}
              selectedPlaceKey={selectedPlaceKey}
              onSelectProblem={selectProblem}
              onSelectPlace={selectPlace}
              comparison={comparison}
              passedChecks={report.passedChecks}
              checked={report.checked}
            />
          </div>
          <div className="order-1 lg:sticky lg:top-4 lg:order-2">
            <PageViewer
              pageLayouts={pageLayouts}
              problems={report.problems}
              selectedProblem={selected}
              selectedPlaceKey={selectedPlaceKey}
              onSelect={selectPlace}
              pageId={pageId}
              onPageChange={(id) => {
                setPageId(id);
                setSelectedPlaceKey(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (!reviewing) return content;

  return (
    <div ref={splitRef} style={{ height: splitHeight ?? undefined }} className="flex min-h-0 flex-col">
      <ResizablePanelGroup direction="vertical" autoSaveId="summary-review-split">
        <ResizablePanel id="report" order={1} minSize={15} className="scrollbar-thin !overflow-y-auto">
          {content}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className={cn('my-1 bg-transparent hover:bg-transparent', review === 'minimized' && 'hidden')}
          aria-label="Resize the summary review"
        />
        <ResizablePanel
          id="review"
          order={2}
          ref={reviewPanel}
          defaultSize={50}
          minSize={30}
          collapsible
          collapsedSize={0}
          onCollapse={() => setReview('minimized')}
          onExpand={() => setReview('open')}
        >
          <div className="h-full overflow-hidden rounded-t-xl border border-b-0 shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.45)]">
            <SummaryReview
              doc={summaryDoc}
              templateName={templateName}
              comments={drafts}
              onCommentsChange={setDrafts}
              onMinimize={() => reviewPanel.current?.collapse()}
              onClose={() => setReview('closed')}
              onCopied={handleCopied}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {review === 'minimized' && (
        <div className="overflow-hidden rounded-t-xl border border-b-0">
          <SummaryReviewBar
            commentCount={drafts.length}
            onExpand={() => reviewPanel.current?.expand()}
            onClose={() => setReview('closed')}
          />
        </div>
      )}
    </div>
  );
}

export default ReportView;
