import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '../../types';
import SummaryHeader from './SummaryHeader';
import ChangesPanel from './ChangesPanel';
import ProblemList from './ProblemList';
import PageViewer from './PageViewer';
import { buildReport, compareReports, type Problem } from './buildReport';
import { buildCustomerSummary } from './customerSummary';

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
  const customerSummary = useMemo(() => buildCustomerSummary(report, templateName), [report, templateName]);
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

  return (
    <div className="flex flex-col gap-4 pb-10 pt-2">
      <SummaryHeader
        report={report}
        templateName={templateName}
        pageCount={pageLayouts.length}
        previousCounts={previousReport?.placeCounts ?? null}
        onJumpTo={(severity) =>
          document.getElementById(`report-section-${severity}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        customerSummary={customerSummary}
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
}

export default ReportView;
