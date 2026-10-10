import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { AnalyticsLoadingState } from '../Analytics/Analytics';
import { PageShell, RowSkeleton } from './page-kit';
import { cn } from '../../lib/utils';

/** Same footprint as PageHeader: icon + title on one line, description underneath. */
function HeaderSkeleton({ centered = false }: { centered?: boolean }) {
  return (
    <div className={cn('mb-8 space-y-2.5', centered && 'flex flex-col items-center')}>
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-7 w-44 rounded" />
      </div>
      <Skeleton className="h-4 w-80 max-w-full rounded" />
    </div>
  );
}

function CheckTemplateSkeleton() {
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 pb-24 pt-10 sm:px-6">
      <div className="w-full max-w-2xl">
        <HeaderSkeleton centered />
        <div className="flex min-h-[13rem] flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20">
          <Skeleton className="h-[72px] w-[60px] rounded-md" />
          <Skeleton className="mt-5 h-4 w-56 rounded" />
          <Skeleton className="mt-2 h-3 w-44 rounded" />
        </div>
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
      </div>
    </div>
  );
}

function ListPageSkeleton({ leading }: { leading: 'avatar' | 'tile' }) {
  return (
    <PageShell>
      <HeaderSkeleton />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="hidden h-9 w-40 rounded-lg sm:block" />
        </div>
        <RowSkeleton rows={leading === 'avatar' ? 5 : 2} leading={leading} />
      </div>
    </PageShell>
  );
}

/**
 * Placeholder for the page at `pathname` while the app checks access. It mirrors each page's layout so
 * nothing jumps when the real page renders.
 */
export function PageSkeleton({ pathname }: { pathname: string }) {
  let content: React.ReactNode;
  if (pathname === '/' || pathname === '') {
    content = <CheckTemplateSkeleton />;
  } else if (pathname.startsWith('/analytics')) {
    content = (
      <PageShell className="max-w-6xl">
        <HeaderSkeleton />
        <AnalyticsLoadingState />
      </PageShell>
    );
  } else if (pathname.startsWith('/admin')) {
    content = <ListPageSkeleton leading="avatar" />;
  } else if (pathname.startsWith('/api-keys')) {
    content = <ListPageSkeleton leading="tile" />;
  } else {
    content = (
      <PageShell>
        <HeaderSkeleton />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    );
  }
  return (
    // Fade in after a beat so a quick access check never flashes a skeleton.
    <div
      className="flex w-full flex-1 flex-col animate-in fade-in fill-mode-both duration-300 [animation-delay:150ms]"
      aria-busy="true"
      aria-label="Loading"
    >
      {content}
    </div>
  );
}
