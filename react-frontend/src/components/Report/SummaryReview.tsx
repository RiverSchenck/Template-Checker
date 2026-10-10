import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lock, MessageSquarePlus, Pencil, ThumbsUp, Trash2, TriangleAlert } from 'lucide-react';
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

const GENERAL = { id: 'general', key: 'general', title: 'General feedback' };
const LOOKS_GOOD = 'Looks good to send.';
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
  submitting: boolean;
  saved: boolean;
  error: string | null;
  copyHint: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

/** Sticky bar while reviewing: what to do, and the one action that copies the summary. */
export function ReviewToolbar({ commentCount, submitting, saved, error, copyHint, onBack, onSubmit }: ReviewToolbarProps) {
  const needsComment = commentCount === 0 && !saved;
  const label = submitting
    ? 'Saving…'
    : saved
      ? 'Copy summary'
      : needsComment
        ? 'Leave a comment to copy'
        : `Send ${commentCount === 1 ? 'feedback' : `${commentCount} comments`} & copy`;
  return (
    <div className="sticky top-0 z-20 rounded-xl border bg-background/95 px-4 py-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Results
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Review customer summary</h2>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Read it next to the results. Click a part to see it on the page, or select text to comment on it.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span keeps the tooltip working while the button is disabled */}
            <span tabIndex={needsComment ? 0 : -1}>
              <Button onClick={onSubmit} disabled={submitting || needsComment} className="gap-1.5">
                {needsComment && <Lock className="h-3.5 w-3.5" aria-hidden />}
                {label}
              </Button>
            </span>
          </TooltipTrigger>
          {needsComment && (
            <TooltipContent side="bottom" className="max-w-[16rem] text-center">
              Leave at least one comment, even “Looks good to send”, to copy the summary.
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      {(error || copyHint) && (
        <p
          role={error ? 'alert' : undefined}
          aria-live="polite"
          className={cn('mt-2 flex items-center gap-1.5 text-xs', error ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}
        >
          {!error && <Lock className="h-3 w-3" aria-hidden />}
          {error ?? 'Leave a comment and send it to copy the summary.'}
        </p>
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
};

/** The customer summary as the customer will get it, with comments inline under the part they're about. */
export function SummaryReviewDocument({ doc, comments, onCommentsChange, activeProblemId, onSelectProblem, summaryRef }: SummaryReviewDocumentProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
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

  const looksGood = () => {
    if (comments.some((c) => c.sectionId === GENERAL.id && c.body === LOOKS_GOOD)) return;
    onCommentsChange([...comments, { ...forSection(GENERAL), id: crypto.randomUUID(), body: LOOKS_GOOD }]);
  };

  const composerCard = (
    <div className="ml-3 mt-2 rounded-lg border border-foreground/20 bg-background p-3 shadow-sm">
      {composer?.quote && (
        <p className="mb-2 line-clamp-3 border-l-2 border-amber-500 pl-2 text-xs italic text-muted-foreground">“{composer.quote}”</p>
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
        className="w-full resize-none rounded-md border bg-background px-2.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Comment"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">⌘↵ to save · Esc to cancel</span>
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

  const commentCards = (sectionId: string) =>
    commentsFor(sectionId).map((c) =>
      composer?.editingId === c.id ? (
        <React.Fragment key={c.id}>{composerCard}</React.Fragment>
      ) : (
        <div
          key={c.id}
          onMouseEnter={() => setActiveCommentId(c.id)}
          onMouseLeave={() => setActiveCommentId(null)}
          className={cn(
            'group/card ml-3 mt-2 flex items-start gap-2.5 rounded-lg border bg-background px-3 py-2 transition-shadow',
            activeCommentId === c.id && 'ring-1 ring-amber-500/60'
          )}
        >
          <div className="min-w-0 flex-1">
            {c.quote && <p className="mb-0.5 line-clamp-1 text-xs italic text-muted-foreground">“{c.quote}”</p>}
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{c.body}</p>
          </div>
          <div className="-mr-1 flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100">
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => openComposer({ ...c, editingId: c.id }, c.body)}
              aria-label="Edit comment"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
              onClick={() => onCommentsChange(comments.filter((x) => x.id !== c.id))}
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )
    );

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-2.5 border-b bg-amber-500/10 px-4 py-3 text-sm leading-relaxed">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <p>
          <span className="font-semibold">Please read it before you send it.</span> I&apos;m still testing this, so tell me
          what looks off, or that it looks good. <span className="whitespace-nowrap text-muted-foreground">— River</span>
        </p>
      </div>

      <article ref={summaryRef} className="space-y-0.5 p-2" aria-label="Customer summary" onMouseUp={readSelection} onKeyUp={readSelection}>
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
                  'group relative rounded-lg border-l-2 border-transparent px-3 py-2 transition-colors',
                  section.problemId && 'cursor-pointer',
                  active ? 'border-foreground/60 bg-muted/60' : 'hover:bg-muted/40'
                )}
              >
                <p
                  data-section-text={section.id}
                  className="whitespace-pre-wrap break-words pr-8 text-[13.5px] leading-relaxed text-foreground"
                >
                  {segments(section, comments).map((seg, i) =>
                    seg.ids.length ? (
                      <mark
                        key={i}
                        className={cn(
                          'rounded-[2px] border-b-2 border-amber-500 bg-amber-400/20 text-inherit transition-colors',
                          seg.ids.includes(activeCommentId ?? '') && 'bg-amber-400/45'
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
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Comment on ${section.title}`}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Comment on this part</TooltipContent>
                </Tooltip>
              </div>
              {commentCards(section.id)}
              {composer && !composer.editingId && composer.sectionId === section.id && composerCard}
            </div>
          );
        })}
      </article>

      <div className="border-t px-4 py-3">
        {commentCards(GENERAL.id)}
        {composer && !composer.editingId && composer.sectionId === GENERAL.id && composerCard}
        <div className={cn('flex flex-wrap items-center gap-2', (commentsFor(GENERAL.id).length > 0 || composer?.sectionId === GENERAL.id) && 'mt-3')}>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={looksGood}>
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
            Looks good to send
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={() => openComposer(forSection(GENERAL))}>
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
