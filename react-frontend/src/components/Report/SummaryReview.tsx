import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Lock, MessageSquarePlus, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
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

type Selection = { section: SummarySection; start: number; end: number; quote: string; top: number; left: number };
type Composer = { sectionId: string; sectionKey: string; sectionTitle: string; quote: string | null; quoteStart: number | null; quoteEnd: number | null; editingId?: string };

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

type SummaryReviewProps = {
  doc: SummaryDocument;
  templateName: string;
  comments: DraftComment[];
  onCommentsChange: (comments: DraftComment[]) => void;
  onMinimize: () => void;
  onClose: () => void;
  /** Called once the review is saved and the summary is on the clipboard. */
  onCopied: (commentCount: number) => void;
};

/** Review the customer summary before copying it: read it, comment on parts of it, then confirm or send feedback. */
export function SummaryReview({ doc, templateName, comments, onCommentsChange, onMinimize, onClose, onCopied }: SummaryReviewProps) {
  const { session } = useAuth();
  const docRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [composerText, setComposerText] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noFeedback, setNoFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState(false);
  const [saved, setSaved] = useState(false);

  const sectionsById = useMemo(() => new Map(doc.sections.map((s) => [s.id, s])), [doc.sections]);
  const ordered = useMemo(() => {
    const index = (c: DraftComment) => (c.sectionId === GENERAL.id ? Infinity : doc.sections.findIndex((s) => s.id === c.sectionId));
    return [...comments].sort((a, b) => index(a) - index(b) || (a.quoteStart ?? -1) - (b.quoteStart ?? -1));
  }, [comments, doc.sections]);
  const sectionsWithNotes = useMemo(
    () => new Set(comments.filter((c) => c.quote == null).map((c) => c.sectionId)),
    [comments]
  );
  const unlocked = saved;
  const canSubmit = !submitting && (comments.length > 0 || noFeedback);

  useEffect(() => {
    if (composer) composerRef.current?.focus();
  }, [composer]);

  useEffect(() => {
    if (!copyHint) return;
    const t = setTimeout(() => setCopyHint(false), 3000);
    return () => clearTimeout(t);
  }, [copyHint]);

  const readSelection = () => {
    const sel = window.getSelection();
    const container = docRef.current;
    if (!sel || sel.isCollapsed || !sel.rangeCount || !container) return setSelection(null);
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
    const box = container.getBoundingClientRect();
    setSelection({
      section,
      start: section.start + start,
      end: section.start + end,
      quote: section.text.slice(start, end),
      top: rect.top - box.top + container.scrollTop - 40,
      left: Math.min(Math.max(rect.left - box.left + rect.width / 2, 60), box.width - 60),
    });
  };

  const openComposer = (next: Composer, text = '') => {
    setComposer(next);
    setComposerText(text);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const commentOnSelection = () => {
    if (!selection) return;
    openComposer({
      sectionId: selection.section.id,
      sectionKey: selection.section.key,
      sectionTitle: selection.section.title,
      quote: selection.quote,
      quoteStart: selection.start,
      quoteEnd: selection.end,
    });
  };

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
    setNoFeedback(false);
  };

  const blockCopy = (e: React.ClipboardEvent) => {
    if (unlocked) return;
    e.preventDefault();
    setCopyHint(true);
  };

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

  /** Save the review. Returns false (and shows why) if it couldn't be saved. */
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
    setError('Your review was saved, but the summary couldn’t be copied. Click Copy summary to try again.');

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

  const composerCard = composer && (
    <div className="rounded-lg border border-foreground/20 bg-background p-3 shadow-sm">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        {composer.editingId ? 'Edit comment' : 'New comment'} · {composer.sectionTitle}
      </p>
      {composer.quote && (
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
        rows={3}
        placeholder="What should change, and why?"
        className="w-full resize-none rounded-md border bg-background px-2.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Comment"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">⌘↵ to save</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => setComposer(null)}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 px-2.5 text-xs" disabled={!composerText.trim()} onClick={saveComposer}>
            {composer.editingId ? 'Save' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Review customer summary</h2>
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Beta</span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize} aria-label="Minimize">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Minimize to check the results</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (your comments are kept)</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-1">
        {/* The summary, as the customer will get it */}
        <div
          ref={docRef}
          className="scrollbar-thin relative min-h-0 overflow-y-auto px-4 py-5 sm:px-8"
          onMouseUp={readSelection}
          onKeyUp={readSelection}
          onCopy={blockCopy}
          onCut={blockCopy}
          onContextMenu={(e) => !unlocked && e.preventDefault()}
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <p>
                <span className="font-semibold">Please read it before you send it.</span> I&apos;m still testing this, so
                select anything that looks off and leave a comment. <span className="whitespace-nowrap text-muted-foreground">— River</span>
              </p>
            </div>

            <article className="space-y-1" aria-label="Customer summary">
              {doc.sections.map((section) => (
                <div
                  key={section.id}
                  className={cn(
                    'group relative rounded-md border-l-2 border-transparent px-3 py-2 transition-colors hover:bg-muted/40',
                    sectionsWithNotes.has(section.id) && 'border-amber-500/70'
                  )}
                >
                  <p
                    data-section-text={section.id}
                    className={cn(
                      'whitespace-pre-wrap break-words pr-8 text-[13.5px] leading-relaxed text-foreground',
                      section.key === 'intro' || section.key === 'closing' ? '' : 'font-[450]'
                    )}
                  >
                    {segments(section, comments).map((seg, i) =>
                      seg.ids.length ? (
                        <mark
                          key={i}
                          className={cn(
                            'cursor-pointer rounded-[2px] border-b-2 border-amber-500 bg-amber-400/20 text-inherit transition-colors',
                            seg.ids.includes(activeId ?? '') && 'bg-amber-400/45'
                          )}
                          onMouseEnter={() => setActiveId(seg.ids[0])}
                          onMouseLeave={() => setActiveId(null)}
                          onClick={() => document.getElementById(`comment-${seg.ids[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
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
                        onClick={() =>
                          openComposer({ sectionId: section.id, sectionKey: section.key, sectionTitle: section.title, quote: null, quoteStart: null, quoteEnd: null })
                        }
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Comment on ${section.title}`}
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Comment on this part</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </article>
          </div>

          {selection && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commentOnSelection}
              style={{ top: selection.top, left: selection.left }}
              className="absolute z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg animate-in fade-in zoom-in-95"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              Comment
            </button>
          )}
        </div>

        {/* Comments */}
        <aside className="flex min-h-0 flex-col border-t bg-muted/20 md:border-l md:border-t-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-xs font-medium">Comments</p>
            {comments.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{comments.length}</span>}
          </div>
          <div className="scrollbar-thin max-h-48 flex-1 space-y-2 overflow-y-auto p-3 md:max-h-none">
            {composer && !composer.editingId && composerCard}
            {ordered.map((c) =>
              composer?.editingId === c.id ? (
                <React.Fragment key={c.id}>{composerCard}</React.Fragment>
              ) : (
                <div
                  key={c.id}
                  id={`comment-${c.id}`}
                  onMouseEnter={() => setActiveId(c.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={cn(
                    'group/card rounded-lg border bg-background p-3 transition-shadow',
                    activeId === c.id && 'shadow-sm ring-1 ring-amber-500/50'
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{c.sectionTitle}</p>
                    <div className="-mr-1 -mt-1 flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100">
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
                  {c.quote && (
                    <p className="mb-1.5 line-clamp-2 border-l-2 border-amber-500 pl-2 text-xs italic text-muted-foreground">“{c.quote}”</p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm leading-snug">{c.body}</p>
                </div>
              )
            )}
            {comments.length === 0 && !composer && (
              <div className="px-2 py-6 text-center">
                <p className="text-sm font-medium">No comments yet</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Select text in the summary, or hover a part of it, to leave a comment.
                </p>
              </div>
            )}
          </div>
          <div className="border-t p-3">
            <button
              type="button"
              onClick={() =>
                openComposer({ sectionId: GENERAL.id, sectionKey: GENERAL.key, sectionTitle: GENERAL.title, quote: null, quoteStart: null, quoteEnd: null })
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              General feedback
            </button>
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          {comments.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {comments.length === 1 ? '1 comment' : `${comments.length} comments`} will be sent to River with this summary.
            </p>
          ) : (
            <label htmlFor="summary-no-feedback" className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                id="summary-no-feedback"
                checked={noFeedback}
                onCheckedChange={(v) => setNoFeedback(v === true)}
                className="mt-0.5"
              />
              <span className={noFeedback ? 'text-foreground' : 'text-muted-foreground'}>
                I&apos;ve read this summary and have no feedback.
              </span>
            </label>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            copyHint && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
                <Lock className="h-3 w-3" aria-hidden />
                {comments.length > 0 ? 'Send your feedback to copy the summary.' : 'Tick the box above to copy the summary.'}
              </p>
            )
          )}
        </div>
        <Button onClick={submit} disabled={!canSubmit} className="gap-1.5">
          {submitting ? 'Saving…' : saved ? 'Copy summary' : comments.length > 0 ? 'Send feedback & copy' : 'Copy summary'}
        </Button>
      </footer>
    </div>
  );
}

/** The review collapsed to a bar so people can check the results. */
export function SummaryReviewBar({ commentCount, onExpand, onClose }: { commentCount: number; onExpand: () => void; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t bg-background px-4 py-2.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
      <p className="min-w-0 truncate text-sm">
        <span className="font-medium">Reviewing customer summary</span>
        <span className="text-muted-foreground">
          {' · '}
          {commentCount === 0 ? 'no comments yet' : commentCount === 1 ? '1 comment' : `${commentCount} comments`}
        </span>
      </p>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={onExpand}>
          Continue review
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close review">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
