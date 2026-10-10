import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Frame, Info, MoveUpRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { PageLayout } from '../../types';
import { cn } from '../../lib/utils';
import PageCanvas, { placeOnPage, severityStyles, type CanvasMarker } from './pages/PageCanvas';
import PageTabs, { type SeverityCounts } from './pages/PageTabs';
import { SEVERITIES, type Place, type Problem } from './buildReport';

type PageViewerProps = {
  pageLayouts: PageLayout[];
  problems: Problem[];
  /** When set, only this problem is highlighted; otherwise everything is. */
  selectedProblem: Problem | null;
  selectedPlaceKey: string | null;
  onSelect: (problemId: string, placeKey: string | null) => void;
  pageId: string | null;
  onPageChange: (pageId: string) => void;
};

type ViewerMarker = CanvasMarker & { place: Place; problem: Problem };

/** The page preview with the issues drawn on it. */
function PageViewer({
  pageLayouts,
  problems,
  selectedProblem,
  selectedPlaceKey,
  onSelect,
  pageId,
  onPageChange,
}: PageViewerProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [showOutlines, setShowOutlines] = useState(false);

  const { markersByPage, ordered, countsByPage } = useMemo(() => {
    const scope = selectedProblem ? [selectedProblem] : problems;
    const byPage: Record<string, ViewerMarker[]> = {};
    const counts: Record<string, SeverityCounts> = {};
    scope.forEach((problem) =>
      problem.subjects.forEach((subject) =>
        subject.places.forEach((place) => {
          if (!place.bounds) return;
          const id = place.bounds.page_id;
          (byPage[id] ??= []).push({ key: place.key, bounds: place.bounds, severity: problem.severity, title: problem.guide.title, place, problem });
          (counts[id] ??= { errors: 0, warnings: 0, infos: 0 })[problem.severity] += 1;
        })
      )
    );
    // Draw less severe boxes first so errors sit on top.
    Object.values(byPage).forEach((markers) =>
      markers.sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity))
    );
    const orderedMarkers = pageLayouts.flatMap((page) =>
      [...(byPage[page.page_id] ?? [])].sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    );
    return { markersByPage: byPage, ordered: orderedMarkers, countsByPage: counts };
  }, [selectedProblem, problems, pageLayouts]);

  const pageIndex = Math.max(0, pageLayouts.findIndex((p) => p.page_id === pageId));
  const page = pageLayouts[pageIndex];
  const markers = page ? markersByPage[page.page_id] ?? [] : [];
  const selectedMarker = markers.find((m) => m.key === selectedPlaceKey);
  const selectedIndex = ordered.findIndex((m) => m.key === selectedPlaceKey);

  const stepIssue = (direction: 1 | -1) => {
    if (!ordered.length) return;
    const next =
      selectedIndex === -1
        ? Math.max(0, ordered.findIndex((m) => m.bounds.page_id === page?.page_id))
        : (selectedIndex + direction + ordered.length) % ordered.length;
    const marker = ordered[next];
    onPageChange(marker.bounds.page_id);
    onSelect(marker.problem.id, marker.key);
  };

  const stepPage = (direction: 1 | -1) => {
    const next = pageLayouts[pageIndex + direction];
    if (next) onPageChange(next.page_id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="menu"], [role="dialog"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        stepIssue(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!page) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
        No page layout in this result. Run the check again to see issues on the page.
      </div>
    );
  }

  const selectedOffPage = selectedMarker ? placeOnPage(selectedMarker.bounds, page).offPage : false;
  const problemNotOnPages = selectedProblem && ordered.length === 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        <PageTabs
          pages={pageLayouts}
          currentPageId={page.page_id}
          countsByPage={countsByPage}
          onSelectPage={onPageChange}
        />
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', (showOutlines || !page.preview) && 'bg-muted text-foreground')}
                onClick={() => setShowOutlines((v) => !v)}
                disabled={!page.preview}
                aria-pressed={showOutlines || !page.preview}
                aria-label="Show frame outlines"
              >
                <Frame className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show frame outlines</TooltipContent>
          </Tooltip>
          {ordered.length > 0 && (
            <div className="ml-1 flex items-center rounded-md border border-border">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-r-none" onClick={() => stepIssue(-1)} aria-label="Previous issue">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[4.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground">
                {selectedIndex >= 0 ? `${selectedIndex + 1} of ${ordered.length}` : `${ordered.length} issues`}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-l-none" onClick={() => stepIssue(1)} aria-label="Next issue">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stage */}
      <div className="relative bg-[color-mix(in_oklab,var(--muted)_45%,transparent)] px-4 py-8 sm:px-12">
        {problemNotOnPages && (
          <div className="mx-auto mb-4 flex max-w-xl items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              This isn’t on a page. It’s about {selectedProblem!.subjects.slice(0, 3).map((s) => s.label).join(', ')}
              {selectedProblem!.subjects.length > 3 ? ` and ${selectedProblem!.subjects.length - 3} more` : ''}.
            </span>
          </div>
        )}
        <div className="mx-auto" style={{ maxWidth: `min(100%, calc((100vh - 280px) * ${page.width / page.height}))` }}>
          <PageCanvas
            page={page}
            markers={markers}
            selectedKey={selectedPlaceKey}
            hoverKey={hoverKey}
            showOutlines={showOutlines}
            onHover={setHoverKey}
            onSelect={(key) => {
              const marker = markers.find((m) => m.key === key);
              if (marker) onSelect(marker.problem.id, key === selectedPlaceKey ? null : key);
            }}
            selectedLabel={selectedMarker?.problem.guide.title}
          />
        </div>
        {pageLayouts.length > 1 && (
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full text-muted-foreground"
              onClick={() => stepPage(-1)}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full text-muted-foreground"
              onClick={() => stepPage(1)}
              disabled={pageIndex === pageLayouts.length - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* What's selected */}
      <div className="flex min-h-[3.25rem] items-center gap-3 border-t border-border px-4 py-2.5 text-sm">
        {selectedMarker ? (
          <>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', severityStyles[selectedMarker.severity].dot)} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-foreground">
                {selectedMarker.place.frameText ?? selectedMarker.place.frameLabel}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[selectedMarker.problem.guide.title, selectedMarker.place.context].filter(Boolean).join(' · ')}
              </span>
            </span>
            {selectedOffPage && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <MoveUpRight className="h-3.5 w-3.5" aria-hidden />
                Outside the page
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {!page.preview
              ? 'No preview saved for this page, so only frame outlines are shown. InDesign usually saves previews for the first 2 pages only.'
              : markers.length
                ? 'Click a highlighted frame, or use ← → to go through the issues.'
                : 'No issues on this page.'}
          </span>
        )}
      </div>
    </div>
  );
}

export default PageViewer;
