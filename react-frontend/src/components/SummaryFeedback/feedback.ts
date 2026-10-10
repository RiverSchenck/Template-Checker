import { GENERAL, LOOKS_GOOD } from '../Report/SummaryReview';
import type { SummaryComment } from './api';

/** The one-click "Looks good to send." general comment from review mode. */
export const isApproval = (c: Pick<SummaryComment, 'section_key' | 'body'>) =>
  c.section_key === GENERAL.key && c.body === LOOKS_GOOD;

export type StatusFilter = 'all' | 'open' | 'resolved';
export type TypeFilter = 'all' | 'comments' | 'approvals';

export function matchesFilters(c: SummaryComment, status: StatusFilter, type: TypeFilter): boolean {
  if (status === 'open' && c.resolved_at) return false;
  if (status === 'resolved' && !c.resolved_at) return false;
  if (type === 'comments' && isApproval(c)) return false;
  if (type === 'approvals' && !isApproval(c)) return false;
  return true;
}

/** Case-insensitive match on the comment, its quote, section, template or author. */
export function matchesQuery(c: SummaryComment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.body, c.quote, c.section_title, c.template_name, c.user_display_name, c.user_email].some((f) =>
    f?.toLowerCase().includes(q)
  );
}

const time = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** Real comments first, then approvals; newest first within each. */
export function sortComments(comments: SummaryComment[]): SummaryComment[] {
  return [...comments].sort(
    (a, b) => Number(isApproval(a)) - Number(isApproval(b)) || time(b.created_at) - time(a.created_at)
  );
}

export type FeedbackGroup = {
  /** What the group is keyed on: the section title, or the section key when there's no title. */
  id: string;
  title: string;
  sectionKey: string;
  comments: SummaryComment[];
  openCount: number;
};

/** Sections that aren't a checker issue. They go last, in this order. */
const TRAILING_KEYS = ['intro', 'closing', GENERAL.key];

/**
 * Comments grouped by the issue they're on. Groups with the most open comments come first; the
 * introduction, closing and general feedback (where approvals live) go last.
 */
export function groupComments(comments: SummaryComment[]): FeedbackGroup[] {
  const byId = new Map<string, FeedbackGroup>();
  for (const c of comments) {
    const id = c.section_title?.trim() || c.section_key;
    let group = byId.get(id);
    if (!group) {
      group = { id, title: id, sectionKey: c.section_key, comments: [], openCount: 0 };
      byId.set(id, group);
    }
    group.comments.push(c);
    if (!c.resolved_at) group.openCount += 1;
  }
  // -1 for issues, so they sort before the trailing sections.
  const trailing = (g: FeedbackGroup) => TRAILING_KEYS.indexOf(g.sectionKey);
  return Array.from(byId.values())
    .map((g) => ({ ...g, comments: sortComments(g.comments) }))
    .sort(
      (a, b) =>
        trailing(a) - trailing(b) ||
        b.openCount - a.openCount ||
        b.comments.length - a.comments.length ||
        a.title.localeCompare(b.title)
    );
}

/**
 * Where the quote sits in the summary snapshot. Uses the saved offsets when they still point at the quote,
 * otherwise the first place the quote appears; null when it can't be found.
 */
export function quoteRange(c: Pick<SummaryComment, 'summary' | 'quote' | 'quote_start' | 'quote_end'>): [number, number] | null {
  const { summary, quote, quote_start: start, quote_end: end } = c;
  if (!summary || !quote) return null;
  if (start != null && end != null && start >= 0 && end <= summary.length && summary.slice(start, end) === quote) {
    return [start, end];
  }
  const i = summary.indexOf(quote);
  return i === -1 ? null : [i, i + quote.length];
}
