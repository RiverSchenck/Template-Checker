import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Lock, MessageSquarePlus, Pencil, ThumbsUp, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { responseError } from '../../lib/notify';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import type { SummaryDocument, SummarySection } from './customerSummary';

/** A comment the reviewer is drafting; saved with the review when they copy. */
export type DraftComment = {
  id: string;
  sectionId: string;
  sectionKey: string;
  sectionTitle: string;
  quote: string | null;
  /** Offsets of the quote within the full summary text. */
  quoteStart: number | null;
  quoteEnd: number | null;
  body: string;
};

export const GENERAL = { id: 'general', key: 'general', title: 'General feedback' };
export const LOOKS_GOOD = 'Looks good to send.';

export const hasLooksGood = (comments: DraftComment[]) =>
  comments.some((c) => c.sectionId === GENERAL.id && c.body === LOOKS_GOOD);

/** Adds the one-click "Looks good to send." general comment (once). */
export function withLooksGood(comments: DraftComment[]): DraftComment[] {
  if (hasLooksGood(comments)) return comments;
  return [
    ...comments,
    {
      id: crypto.randomUUID(),
      sectionId: GENERAL.id,
      sectionKey: GENERAL.key,
      sectionTitle: GENERAL.title,
      quote: null,
      quoteStart: null,
      quoteEnd: null,
      body: LOOKS_GOOD,
    },
  ];
}
const MAX_BODY = 2000;

/** Character offset of (node, offset) within `root`'s text. Works across highlight <mark>s. */
function textOffset(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

function sectionTextElement(node: Node | null): HTMLElement | null {
  const el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  return el?.closest<HTMLElement>('[data-section-text]') ?? null;
}

/** The section's text split into plain runs and highlighted runs (one per overlapping set of quotes). */
function segments(section: SummarySection, comments: DraftComment[]) {
  const ranges = comments
    .filter((c) => c.sectionId === section.id && c.quoteStart != null && c.quoteEnd != null)
    .map((c) => ({ id: c.id, start: c.quoteStart! - section.start, end: c.quoteEnd! - section.start }));
  const cuts = Array.from(new Set([0, section.text.length, ...ranges.flatMap((r) => [r.start, r.end])])).sort((a, b) => a - b);
  const out: { text: string; ids: string[] }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    out.push({ text: section.text.slice(a, b), ids: ranges.filter((r) => r.start <= a && r.end >= b).map((r) => r.id) });
  }
  return out;
}

type Selection = { section: SummarySection; start: number; end: number; quote: string; top: number; left: number };
type Composer = Omit<DraftComment, 'id' | 'body'> & { editingId?: string };

// ---------------------------------------------------------------------------------------------------------------
// Saving and copying

/** Save the review, then copy the summary. Returns what the toolbar needs. */
export function useSummaryReviewSubmit(
  doc: SummaryDocument,
  templateName: string,
  comments: DraftComment[],
  onCopied: (commentCount: number) => void
) {
  const { session } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different summary (new upload) starts a fresh review.
  useEffect(() => {
    setSaved(false);
    setError(null);
  }, [doc.text]);

  /** Copy with the async clipboard API, falling back to the classic copy command if it's blocked. */
  const copyNow = async () => {
    try {
      await navigator.clipboard.writeText(doc.text);
    } catch {
      const area = document.createElement('textarea');
      area.value = doc.text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) throw new Error('copy failed');
    }
  };

  const saveReview = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${baseURL}/summary-reviews`, {
        method: 'POST',
        headers: { ...getAuthHeaders(session?.access_token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: templateName,
          summary: doc.text,
          comments: comments.map((c) => ({
            section_key: c.sectionKey,
            section_title: c.sectionTitle,
            quote: c.quote,
            quote_start: c.quoteStart,
            quote_end: c.quoteEnd,
            body: c.body,
          })),
        }),
      });
      if (!res.ok) {
        setError(await responseError(res, 'Couldn’t save your review. Try again.'));
        return false;
      }
      return true;
    } catch {
      setError('Couldn’t save your review. Check your connection and try again.');
      return false;
    }
  };

  const copyFailed = () =>
    setError('Your feedback was saved, but the summary couldn’t be copied. Click Copy summary to try again.');

  const submit = async () => {
    setError(null);
    if (saved) {
      try {
        await copyNow();
        onCopied(comments.length);
      } catch {
        copyFailed();
      }
      return;
    }
    if (comments.length === 0) return;
    setSubmitting(true);
    const saving = saveReview();
    // Browsers only allow clipboard writes during the click, so start the copy now and hand it the text once the
    // review is saved (a failed save rejects it, so nothing is copied). Older browsers copy after saving instead.
    const text = saving.then((ok) => {
      if (!ok) throw new Error('not saved');
      return new Blob([doc.text], { type: 'text/plain' });
    });
    const copying =
      typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
        ? navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
        : text.then(() => copyNow());
    copying.catch(() => undefined);
    const ok = await saving;
    if (!ok) {
      setSubmitting(false);
      return;
    }
    setSaved(true);
    try {
      await copying;
      onCopied(comments.length);
    } catch {
      copyFailed();
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, saved, error };
}

/**
 * Until the review is saved, block copying any part of the summary by hand (select + ⌘C, right-click, cut).
 * The copy event fires wherever keyboard focus is, so this listens on the whole document and checks the selection.
 */
export function useCopyGuard(container: React.RefObject<HTMLElement>, active: boolean, onBlocked: () => void) {
  useEffect(() => {
    if (!active) return;
    const touchesSummary = () => {
      const sel = window.getSelection();
      const el = container.current;
      if (!sel || sel.isCollapsed || !el) return false;
      for (let i = 0; i < sel.rangeCount; i++) if (sel.getRangeAt(i).intersectsNode(el)) return true;
      return false;
    };
    const block = (e: ClipboardEvent) => {
      if (!touchesSummary()) return;
      e.preventDefault();
      onBlocked();
    };
    const menu = (e: MouseEvent) => {
      if (container.current?.contains(e.target as Node)) e.preventDefault();
    };
    document.addEventListener('copy', block, true);
    document.addEventListener('cut', block, true);
    document.addEventListener('contextmenu', menu, true);
    return () => {
      document.removeEventListener('copy', block, true);
      document.removeEventListener('cut', block, true);
      document.removeEventListener('contextmenu', menu, true);
    };
  }, [active, container, onBlocked]);
}

// ---------------------------------------------------------------------------------------------------------------
// Toolbar

type ReviewToolbarProps = {
  commentCount: number;
  /** Whether they've scrolled to the end of the summary; copying stays locked until they have. */
  readToEnd: boolean;
  /** 0–1, how far through the summary they've scrolled. */
  progress: number;
  submitting: boolean;
  saved: boolean;
  error: string | null;
  copyHint: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

/** Sticky bar while reviewing: where they are, and the one action that copies the summary. */
export function ReviewToolbar({ commentCount, readToEnd, progress, submitting, saved, error, copyHint, onBack, onSubmit }: ReviewToolbarProps) {
  const needsRead = !readToEnd && !saved;
  const needsComment = !needsRead && commentCount === 0 && !saved;
  const locked = needsRead || needsComment;
  const label = submitting
    ? 'Saving…'
    : saved
      ? 'Copy summary'
      : needsRead
        ? 'Read to the end to copy'
        : needsComment
          ? 'Leave a comment to copy'
          : `Send ${commentCount === 1 ? 'feedback' : `${commentCount} comments`} & copy`;
  const hint = needsRead
    ? 'Read the whole summary first. Copying unlocks at the end.'
    : 'At the end of the summary, confirm it looks good or leave a comment.';
  return (
    <div className="sticky top-0 z-20 overflow-hidden rounded-xl border bg-background/95 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Results
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Review customer summary</h2>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground">Click a part to see it on the page. Select text to comment on it.</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span keeps the tooltip working while the button is disabled */}
            <span tabIndex={locked ? 0 : -1}>
              <Button onClick={onSubmit} disabled={submitting || locked} className="gap-1.5">
                {locked && <Lock className="h-3.5 w-3.5" aria-hidden />}
                {label}
              </Button>
            </span>
          </TooltipTrigger>
          {locked && (
            <TooltipContent side="bottom" className="max-w-[16rem] text-center">
              {hint}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      {(error || copyHint) && (
        <p
          role={error ? 'alert' : undefined}
          aria-live="polite"
          className={cn('-mt-1 flex items-center gap-1.5 px-4 pb-3 text-xs', error ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}
        >
          {!error && <Lock className="h-3 w-3" aria-hidden />}
          {error ?? hint}
        </p>
      )}
      {/* Reading progress through the summary */}
      {!saved && (
        <div className="h-0.5 w-full bg-muted" aria-hidden>
          <div
            className={cn('h-full transition-[width] duration-200 ease-out', readToEnd ? 'bg-foreground/60' : 'bg-foreground/30')}
            style={{ width: `${Math.round((readToEnd ? 1 : progress) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The summary, with inline comments

type SummaryReviewDocumentProps = {
  doc: SummaryDocument;
  comments: DraftComment[];
  onCommentsChange: (comments: DraftComment[]) => void;
  /** The issue shown on the page preview; its section is highlighted. */
  activeProblemId: string | null;
  onSelectProblem: (problemId: string | null) => void;
  /** Wraps the summary text, for the copy guard. */
  summaryRef: React.RefObject<HTMLElement>;
  /** Called with 0–1 as they scroll through the summary (1 = they've reached the end). */
  onProgress: (progress: number) => void;
};

/** The customer summary as the customer will get it, with comments inline under the part they're about. */
export function SummaryReviewDocument({
  doc,
  comments,
  onCommentsChange,
  activeProblemId,
  onSelectProblem,
  summaryRef,
  onProgress,
}: SummaryReviewDocumentProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [composerText, setComposerText] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const sectionsById = useMemo(() => new Map(doc.sections.map((s) => [s.id, s])), [doc.sections]);
  const commentsFor = (sectionId: string) =>
    comments
      .filter((c) => c.sectionId === sectionId)
      .sort((a, b) => (a.quoteStart ?? Infinity) - (b.quoteStart ?? Infinity));

  useEffect(() => {
    if (composer) composerRef.current?.focus();
  }, [composer]);

  // How far through the summary they've read: the bottom of the window against the summary's extent.
  useEffect(() => {
    const update = () => {
      const article = summaryRef.current;
      const end = endRef.current;
      if (!article || !end) return;
      const top = article.getBoundingClientRect().top;
      const bottom = end.getBoundingClientRect().top;
      const span = Math.max(1, bottom - top);
      onProgress(Math.min(1, Math.max(0, (window.innerHeight - top) / span)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [summaryRef, onProgress]);

  const readSelection = () => {
    const sel = window.getSelection();
    const wrap = wrapRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !wrap) return setSelection(null);
    const range = sel.getRangeAt(0);
    const el = sectionTextElement(range.startContainer);
    if (!el || el !== sectionTextElement(range.endContainer)) return setSelection(null);
    const section = sectionsById.get(el.dataset.sectionText ?? '');
    if (!section) return setSelection(null);
    let start = textOffset(el, range.startContainer, range.startOffset);
    let end = textOffset(el, range.endContainer, range.endOffset);
    while (start < end && /\s/.test(section.text[start])) start++;
    while (end > start && /\s/.test(section.text[end - 1])) end--;
    if (end <= start) return setSelection(null);
    const rect = range.getBoundingClientRect();
    const box = wrap.getBoundingClientRect();
    setSelection({
      section,
      start: section.start + start,
      end: section.start + end,
      quote: section.text.slice(start, end),
      top: rect.top - box.top - 40,
      left: Math.min(Math.max(rect.left - box.left + rect.width / 2, 60), box.width - 60),
    });
  };

  const openComposer = (next: Composer, text = '') => {
    setComposer(next);
    setComposerText(text);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const forSection = (section: { id: string; key: string; title: string }): Composer => ({
    sectionId: section.id,
    sectionKey: section.key,
    sectionTitle: section.title,
    quote: null,
    quoteStart: null,
    quoteEnd: null,
  });

  const saveComposer = () => {
    const body = composerText.trim();
    if (!composer || !body) return;
    if (composer.editingId) {
      onCommentsChange(comments.map((c) => (c.id === composer.editingId ? { ...c, body } : c)));
    } else {
      const { editingId: _unused, ...fields } = composer;
      onCommentsChange([...comments, { ...fields, id: crypto.randomUUID(), body }]);
    }
    setComposer(null);
    setComposerText('');
  };

  const composerCard = (
    <div className="mx-4 mb-2 mt-1 rounded-lg border bg-background p-2.5 shadow-sm">
      {composer?.quote && (
        <p className="mb-2 flex gap-1.5 px-1 text-xs text-muted-foreground">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span className="line-clamp-2 italic">“{composer.quote}”</span>
        </p>
      )}
      <textarea
        ref={composerRef}
        value={composerText}
        onChange={(e) => setComposerText(e.target.value.slice(0, MAX_BODY))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveComposer();
          if (e.key === 'Escape') setComposer(null);
        }}
        rows={2}
        placeholder={composer?.sectionId === GENERAL.id ? 'Anything about the summary as a whole?' : 'What should change, and why?'}
        className="w-full resize-none bg-transparent px-1 py-0.5 text-sm placeholder:text-muted-foreground focus:outline-none"
        aria-label="Comment"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="px-1 text-[11px] text-muted-foreground">⌘↵ to save · Esc to cancel</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setComposer(null)}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 px-2.5 text-xs" disabled={!composerText.trim()} onClick={saveComposer}>
            {composer?.editingId ? 'Save' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  );

  // Comments read as quiet notes under the text, not as cards.
  const commentNotes = (sectionId: string) =>
    commentsFor(sectionId).map((c) =>
      composer?.editingId === c.id ? (
        <React.Fragment key={c.id}>{composerCard}</React.Fragment>
      ) : (
        <div
          key={c.id}
          onMouseEnter={() => setActiveCommentId(c.id)}
          onMouseLeave={() => setActiveCommentId(null)}
          className={cn(
            'group/note mx-4 mb-1.5 flex items-start gap-2.5 rounded-md px-2.5 py-1.5 transition-colors',
            activeCommentId === c.id ? 'bg-muted' : 'bg-muted/50'
          )}
        >
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <div className="min-w-0 flex-1">
            {c.quote && <p className="line-clamp-1 text-xs italic text-muted-foreground">“{c.quote}”</p>}
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{c.body}</p>
          </div>
          <div className="-mr-1 flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100">
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={() => openComposer({ ...c, editingId: c.id }, c.body)}
              aria-label="Edit comment"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-destructive"
              onClick={() => onCommentsChange(comments.filter((x) => x.id !== c.id))}
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )
    );

  const looksGoodAdded = hasLooksGood(comments);

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-2.5 border-b bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <p>
          <span className="font-semibold">Please read it before you send it.</span> I&apos;m still testing this, so tell me
          what looks off, or that it looks good. <span className="whitespace-nowrap text-muted-foreground">— River</span>
        </p>
      </div>

      <article ref={summaryRef} className="py-2" aria-label="Customer summary" onMouseUp={readSelection} onKeyUp={readSelection}>
        {doc.sections.map((section) => {
          const active = !!section.problemId && section.problemId === activeProblemId;
          return (
            <div key={section.id}>
              <div
                onClick={() => {
                  if (!window.getSelection()?.isCollapsed) return; // selecting text, not clicking
                  if (section.problemId) onSelectProblem(active ? null : section.problemId);
                }}
                className={cn(
                  'group relative px-5 py-2 transition-colors',
                  section.problemId && 'cursor-pointer',
                  active ? 'bg-muted/70' : section.problemId && 'hover:bg-muted/30'
                )}
              >
                {active && (
                  <span className="pointer-events-none absolute right-12 top-2.5 hidden text-[11px] font-medium text-muted-foreground sm:inline">
                    On the page →
                  </span>
                )}
                <p
                  data-section-text={section.id}
                  className="whitespace-pre-wrap break-words pr-10 text-[13.5px] leading-relaxed text-foreground"
                >
                  {segments(section, comments).map((seg, i) =>
                    seg.ids.length ? (
                      <mark
                        key={i}
                        className={cn(
                          'rounded-[2px] bg-amber-400/25 text-inherit underline decoration-amber-500 decoration-2 underline-offset-[3px] transition-colors',
                          seg.ids.includes(activeCommentId ?? '') && 'bg-amber-400/50'
                        )}
                        onMouseEnter={() => setActiveCommentId(seg.ids[0])}
                        onMouseLeave={() => setActiveCommentId(null)}
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <React.Fragment key={i}>{seg.text}</React.Fragment>
                    )
                  )}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openComposer(forSection(section));
                      }}
                      className="absolute right-3 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Comment on ${section.title}`}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Comment on this part</TooltipContent>
                </Tooltip>
              </div>
              {commentNotes(section.id)}
              {composer && !composer.editingId && composer.sectionId === section.id && composerCard}
            </div>
          );
        })}
      </article>

      {/* The end: confirm it reads well, or leave general feedback. Reaching here unlocks copying. */}
      <div ref={endRef} className="border-t px-5 pb-4 pt-4">
        <p className="text-sm font-medium">That&apos;s the whole summary.</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Does it read well? Confirm it, or tell me what should change.</p>
        {(commentsFor(GENERAL.id).length > 0 || composer?.sectionId === GENERAL.id) && (
          <div className="-mx-4 mt-3">
            {commentNotes(GENERAL.id)}
            {composer && !composer.editingId && composer.sectionId === GENERAL.id && composerCard}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onCommentsChange(withLooksGood(comments))}
            disabled={looksGoodAdded}
          >
            {looksGoodAdded ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ThumbsUp className="h-3.5 w-3.5" aria-hidden />}
            {looksGoodAdded ? 'Marked as good' : 'Looks good to send'}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => openComposer(forSection(GENERAL))}>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            General feedback
          </Button>
        </div>
      </div>

      {selection && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            openComposer({
              sectionId: selection.section.id,
              sectionKey: selection.section.key,
              sectionTitle: selection.section.title,
              quote: selection.quote,
              quoteStart: selection.start,
              quoteEnd: selection.end,
            })
          }
          style={{ top: selection.top, left: selection.left }}
          className="absolute z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg animate-in fade-in zoom-in-95"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          Comment
        </button>
      )}
    </div>
  );
}
