import { baseURL, getAuthHeaders } from '../Analytics/api';
import { responseError } from '../../lib/notify';

/** One comment from a customer summary review, with the review it belongs to. */
export type SummaryComment = {
  id: string;
  review_id: string;
  /** 'intro' | 'closing' | 'general' | a checker key, e.g. 'FONTS_INCLUDED'. */
  section_key: string;
  section_title: string | null;
  /** The exact phrase they selected, if any. */
  quote: string | null;
  /** Offsets of `quote` within `summary`. */
  quote_start: number | null;
  quote_end: number | null;
  body: string;
  created_at: string;
  resolved_at: string | null;
  template_name: string | null;
  /** Snapshot of the whole summary they reviewed. */
  summary: string | null;
  reviewed_at: string | null;
  // Admin endpoint only:
  user_id?: string;
  user_email?: string | null;
  user_display_name?: string | null;
};

export type AdminFeedback = {
  stats: { reviews: number; with_feedback: number; no_feedback: number };
  comments: SummaryComment[];
};

/** The signed-in user's own comments, newest first. */
export async function fetchMyFeedback(token: string): Promise<SummaryComment[]> {
  const res = await fetch(`${baseURL}/summary-reviews/mine`, { headers: getAuthHeaders(token) });
  if (!res.ok) throw new Error(await responseError(res, "Couldn't load your feedback."));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Every comment (open and resolved) with its author, plus review counts. Admins only. */
export async function fetchAdminFeedback(token: string): Promise<AdminFeedback> {
  const res = await fetch(`${baseURL}/admin/summary-feedback?status=all`, { headers: getAuthHeaders(token) });
  if (!res.ok) throw new Error(await responseError(res, "Couldn't load summary feedback."));
  const data = await res.json();
  return {
    stats: data?.stats ?? { reviews: 0, with_feedback: 0, no_feedback: 0 },
    comments: Array.isArray(data?.comments) ? data.comments : [],
  };
}

/**
 * Mark a comment resolved or open again. Returns the updated comment; it has no author or review fields,
 * so callers should only take `resolved_at` from it.
 */
export async function setCommentResolved(token: string, id: string, resolved: boolean): Promise<SummaryComment> {
  const res = await fetch(`${baseURL}/admin/summary-feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolved }),
  });
  if (!res.ok) {
    throw new Error(
      await responseError(res, resolved ? "Couldn't resolve the comment. Try again." : "Couldn't reopen the comment. Try again.")
    );
  }
  return res.json();
}
