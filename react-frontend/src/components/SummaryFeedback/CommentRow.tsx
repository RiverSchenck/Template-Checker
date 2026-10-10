import React from 'react';
import { Check, FileText, RotateCcw, ThumbsUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { PersonAvatar, StatusPill, formatAbsolute, formatRelative, secondaryActionClass } from '../layout/page-kit';
import { displayTemplateName } from '../Report/customerSummary';
import type { SummaryComment } from './api';
import { isApproval } from './feedback';

type Props = {
  comment: SummaryComment;
  onView: (c: SummaryComment) => void;
  /** Admin page: show the author and a Resolve / Reopen action. Without it the row shows an Open/Resolved pill. */
  admin?: { onToggleResolved: (c: SummaryComment) => void; pending: boolean };
  /** Show which part of the summary the comment is on (when the list isn't already grouped by it). */
  showSection?: boolean;
};

const authorName = (c: SummaryComment) => c.user_display_name?.trim() || c.user_email || 'Unknown';

function Meta({ comment: c, withAuthor }: { comment: SummaryComment; withAuthor?: boolean }) {
  const parts = [
    withAuthor ? authorName(c) : null,
    c.template_name ? displayTemplateName(c.template_name) : null,
  ].filter(Boolean);
  return (
    <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {p}
        </React.Fragment>
      ))}
      {parts.length > 0 && <span aria-hidden> · </span>}
      <time dateTime={c.created_at} title={formatAbsolute(c.created_at)}>
        {formatRelative(c.created_at)}
      </time>
    </span>
  );
}

function Actions({ comment: c, onView, admin, compact }: Props & { compact?: boolean }) {
  const resolved = !!c.resolved_at;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn('gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground', compact ? 'h-7' : 'h-8')}
        onClick={() => onView(c)}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        View summary
      </Button>
      {admin && (
        <Button
          variant="outline"
          size="sm"
          className={cn(secondaryActionClass, 'w-[5.75rem] px-2.5 text-xs', compact ? 'h-7' : 'h-8')}
          disabled={admin.pending}
          onClick={() => admin.onToggleResolved(c)}
        >
          {resolved ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
          {resolved ? 'Reopen' : 'Resolve'}
        </Button>
      )}
    </div>
  );
}

function Status({ comment: c }: { comment: SummaryComment }) {
  return c.resolved_at ? (
    <span title={`Resolved ${formatAbsolute(c.resolved_at)}`}>
      <StatusPill tone="green">Resolved</StatusPill>
    </span>
  ) : (
    <StatusPill tone="neutral">Open</StatusPill>
  );
}

/** One summary comment in a `divide-y` list. Approvals ("Looks good to send.") get a compact one-line row. */
export function CommentRow(props: Props) {
  const { comment: c, admin, showSection } = props;
  const resolved = !!c.resolved_at;
  const rowClass = 'px-4 transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 sm:px-5';

  if (isApproval(c)) {
    return (
      <li className={cn(rowClass, 'flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-3')}>
        <div className={cn('flex min-w-0 flex-1 items-center gap-3', resolved && 'opacity-60')}>
          <span className={cn('grid shrink-0 place-items-center', admin ? 'w-7' : 'w-4')}>
            <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </span>
          <span className="shrink-0 text-sm font-medium">Looks good to send</span>
          <Meta comment={c} withAuthor={!!admin} />
          {admin && resolved && (
            <span className="hidden sm:inline">
              <Status comment={c} />
            </span>
          )}
        </div>
        <div className={cn('flex items-center justify-end gap-2', admin ? 'pl-10 sm:pl-0' : 'pl-7 sm:pl-0')}>
          {!admin && <Status comment={c} />}
          <Actions {...props} compact />
        </div>
      </li>
    );
  }

  return (
    <li className={cn(rowClass, 'flex flex-col gap-3 py-3.5 sm:flex-row sm:items-start sm:gap-4')}>
      <div className={cn('flex min-w-0 flex-1 gap-3', resolved && 'opacity-60')}>
        {admin && <PersonAvatar name={c.user_display_name} email={c.user_email} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {admin ? (
              <span className="max-w-full truncate text-sm font-medium" title={c.user_email ?? undefined}>
                {authorName(c)}
              </span>
            ) : (
              showSection && <span className="max-w-full truncate text-sm font-medium">{c.section_title || c.section_key}</span>
            )}
            <Meta comment={c} />
            {admin && resolved && <Status comment={c} />}
          </div>
          {c.quote && (
            <p className="mt-1.5 flex items-start gap-2 text-xs italic text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              <span className="line-clamp-2">“{c.quote}”</span>
            </p>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{c.body}</p>
        </div>
      </div>
      <div className={cn('flex items-center justify-end gap-2', admin && 'pl-10 sm:pl-0')}>
        {!admin && <Status comment={c} />}
        <Actions {...props} />
      </div>
    </li>
  );
}

/** Placeholder rows shaped like CommentRow, under a group header bar when `grouped`. */
export function FeedbackSkeleton({ rows = 4, avatar = true, grouped = false }: { rows?: number; avatar?: boolean; grouped?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading feedback">
      {grouped && (
        <div className="flex items-center gap-2 border-b bg-neutral-50/70 px-4 py-2 dark:bg-neutral-900/40 sm:px-5">
          <Skeleton className="h-3.5 w-44 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      )}
      <ul className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
            {avatar && <Skeleton className="h-7 w-7 shrink-0 rounded-full" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn('h-3.5 rounded', ['w-48', 'w-40', 'w-56', 'w-36'][i % 4])} />
              <Skeleton className={cn('h-3 rounded', ['w-3/4', 'w-2/3', 'w-1/2', 'w-3/5'][i % 4])} />
            </div>
            <Skeleton className="hidden h-8 w-28 rounded-lg sm:block" />
            {avatar && <Skeleton className="hidden h-8 w-[5.75rem] rounded-lg sm:block" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
