import React, { useEffect, useRef } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { PersonCell, StatusPill, formatAbsolute } from '../layout/page-kit';
import { displayTemplateName } from '../Report/customerSummary';
import type { SummaryComment } from './api';
import { isApproval, quoteRange } from './feedback';

/** The summary as the agent reviewed it, with the comment on top and its quote highlighted in the text. */
export function SummarySnapshotSheet({
  comment,
  onClose,
  showAuthor = false,
  footer,
}: {
  comment: SummaryComment | null;
  onClose: () => void;
  showAuthor?: boolean;
  /** Extra actions under the comment, e.g. Resolve on the admin page. */
  footer?: React.ReactNode;
}) {
  const markRef = useRef<HTMLElement>(null);
  const range = comment ? quoteRange(comment) : null;

  useEffect(() => {
    if (!comment || !range) return;
    // Wait for the sheet's slide-in so the scroll lands on the quote.
    const t = setTimeout(() => markRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [comment?.id, range?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={comment != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {comment && (
          <>
            <SheetHeader className="border-b px-6 pb-5 pt-6 text-left">
              <SheetTitle className="break-all pr-6 text-xl tracking-tight">
                {comment.template_name ? displayTemplateName(comment.template_name) : 'Untitled template'}
              </SheetTitle>
              <SheetDescription>Reviewed {formatAbsolute(comment.reviewed_at ?? comment.created_at)}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 px-6 py-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="truncate text-[13px] font-semibold">
                    {comment.section_title || comment.section_key}
                  </h3>
                  {comment.resolved_at ? (
                    <span title={formatAbsolute(comment.resolved_at)}>
                      <StatusPill tone="green">Resolved</StatusPill>
                    </span>
                  ) : (
                    <StatusPill tone="neutral">Open</StatusPill>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/40 px-3.5 py-3">
                  {showAuthor && (
                    <div className="mb-3">
                      <PersonCell name={comment.user_display_name} email={comment.user_email} />
                    </div>
                  )}
                  {isApproval(comment) ? (
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      Looks good to send
                    </p>
                  ) : (
                    <>
                      {comment.quote && (
                        <p className="mb-1.5 flex items-start gap-2 text-xs italic text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          <span>“{comment.quote}”</span>
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
                    </>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">{formatAbsolute(comment.created_at)}</p>
                </div>
                {footer && <div className="mt-3 flex justify-end gap-2">{footer}</div>}
              </div>

              <div>
                <h3 className="mb-2 text-[13px] font-semibold">Customer summary</h3>
                {comment.summary ? (
                  <p className="whitespace-pre-wrap break-words rounded-lg border px-4 py-3.5 text-[13.5px] leading-relaxed">
                    {range ? (
                      <>
                        {comment.summary.slice(0, range[0])}
                        <mark
                          ref={markRef}
                          className="rounded-[2px] bg-amber-400/25 text-inherit underline decoration-amber-500 decoration-2 underline-offset-[3px]"
                        >
                          {comment.summary.slice(range[0], range[1])}
                        </mark>
                        {comment.summary.slice(range[1])}
                      </>
                    ) : (
                      comment.summary
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">The summary wasn’t saved with this review.</p>
                )}
                {comment.quote && comment.summary && !range && (
                  <p className="mt-2 text-xs text-muted-foreground">The quoted text couldn’t be found in this summary.</p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
