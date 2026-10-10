import React from 'react';
import { PageLayout, ValidationType } from '../../../types';
import { cn } from '../../../lib/utils';

export type SeverityCounts = Record<ValidationType, number>;

type PageTabsProps = {
  pages: PageLayout[];
  currentPageId: string;
  countsByPage: Record<string, SeverityCounts>;
  onSelectPage: (pageId: string) => void;
};

const BADGE: Record<ValidationType, string> = {
  errors: 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  warnings: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  infos: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
};

/** Segmented page picker; pages with issues carry a count badge in the colour of their most severe issue. */
function PageTabs({ pages, currentPageId, countsByPage, onSelectPage }: PageTabsProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">Page</span>
      <div
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Pages"
      >
        {pages.map((page) => {
          const active = page.page_id === currentPageId;
          const counts = countsByPage[page.page_id];
          const total = counts ? counts.errors + counts.warnings + counts.infos : 0;
          const worst = counts && (['errors', 'warnings', 'infos'] as ValidationType[]).find((t) => counts[t] > 0);
          const label = page.name || String(page.index);
          return (
            <button
              key={page.page_id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Page ${label}${total ? `, ${total} ${total === 1 ? 'issue' : 'issues'}` : ', no issues'}`}
              onClick={() => onSelectPage(page.page_id)}
              className={cn(
                'flex h-6 shrink-0 items-center gap-1.5 rounded px-2 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : total
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {total > 0 && worst && (
                <span className={cn('min-w-[1.125rem] rounded-full px-1 text-center text-[10px] font-medium leading-4', BADGE[worst])}>
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PageTabs;
