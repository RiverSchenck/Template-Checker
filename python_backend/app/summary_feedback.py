"""Feedback on the customer summary while it's in beta (summary_reviews and summary_comments tables).

Agents review the summary before copying it. Each copy is saved as a review (with a snapshot of the text) and any
comments they left: on a quoted phrase, on a section of the summary, or general. Admins see every comment and mark
them resolved; agents only ever see their own.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from .analytics_api import get_supabase_client

MAX_TEMPLATE_NAME = 300
MAX_SUMMARY = 50_000
MAX_COMMENTS = 50
MAX_BODY = 2000
MAX_QUOTE = 1000
MAX_SECTION_TITLE = 200
# 'intro', 'closing', 'general', or an issue's validation type (e.g. FONTS_INCLUDED).
SECTION_KEY = re.compile(r'^[A-Za-z0-9_.:-]{1,100}$')
STATUSES = ('open', 'resolved', 'all')

COMMENT_COLUMNS = (
    'id, review_id, user_id, section_key, section_title, quote, quote_start, quote_end, body, '
    'created_at, resolved_at, resolved_by'
)


# Validation returns (value, error) instead of raising, so error messages are always our own fixed text and no
# exception detail can reach a response.
Result = tuple[Any, Optional[str]]


def _text(value: Any, field: str, max_len: int, required: bool = True) -> Result:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, (f'{field} is required' if required else None)
    if not isinstance(value, str):
        return None, f'{field} must be text'
    if len(value) > max_len:
        return None, f'{field} must be {max_len} characters or fewer'
    return value, None


def _comment(raw: Any, summary: str) -> Result:
    if not isinstance(raw, dict):
        return None, 'Each comment must be an object'
    section_key = raw.get('section_key')
    if not isinstance(section_key, str) or not SECTION_KEY.match(section_key):
        return None, 'Each comment needs a valid section_key'
    body, error = _text(raw.get('body'), 'Comment', MAX_BODY)
    if error:
        return None, error
    title, error = _text(raw.get('section_title'), 'section_title', MAX_SECTION_TITLE, required=False)
    if error:
        return None, error
    comment = {
        'section_key': section_key,
        'section_title': title.strip() if title else None,
        'body': body.strip(),
        'quote': None,
        'quote_start': None,
        'quote_end': None,
    }
    quote = raw.get('quote')
    if quote is not None and quote != '':
        quote, error = _text(quote, 'Quote', MAX_QUOTE)
        if error:
            return None, error
        start, end = raw.get('quote_start'), raw.get('quote_end')
        valid = all(isinstance(n, int) and not isinstance(n, bool) for n in (start, end))
        # The quote must be exactly the text at those offsets in the summary that was reviewed.
        if not valid or not 0 <= start < end <= len(summary) or summary[start:end] != quote:
            return None, "A quoted comment doesn't match the summary text"
        comment.update(quote=quote, quote_start=start, quote_end=end)
    return comment, None


def validate_review(data: Any) -> Result:
    """((template_name, summary, comments), None) from a request body, or (None, user-safe error message)."""
    if not isinstance(data, dict):
        return None, 'Invalid request'
    template_name, error = _text(data.get('template_name'), 'template_name', MAX_TEMPLATE_NAME)
    if error:
        return None, error
    summary, error = _text(data.get('summary'), 'summary', MAX_SUMMARY)
    if error:
        return None, error
    raw_comments = data.get('comments') or []
    if not isinstance(raw_comments, list):
        return None, 'comments must be a list'
    if len(raw_comments) > MAX_COMMENTS:
        return None, f'You can leave at most {MAX_COMMENTS} comments on one summary'
    comments = []
    for raw in raw_comments:
        comment, error = _comment(raw, summary)
        if error:
            return None, error
        comments.append(comment)
    return (template_name.strip(), summary, comments), None


def create_review(user_id: str, template_name: str, summary: str, comments: list[dict[str, Any]]) -> dict[str, Any]:
    """Save one review and its comments. Returns the review with its saved comments."""
    supabase = get_supabase_client()
    review = dict(supabase.table('summary_reviews').insert({
        'user_id': user_id,
        'template_name': template_name,
        'summary': summary,
        'outcome': 'feedback' if comments else 'no_feedback',
    }).execute().data[0])
    saved = []
    if comments:
        rows = [{**c, 'review_id': review['id'], 'user_id': user_id} for c in comments]
        saved = [dict(r) for r in (supabase.table('summary_comments').insert(rows).execute().data or [])]
    return {**review, 'comments': saved}


def _with_reviews(comments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach each comment's review (template name, summary snapshot, review time)."""
    review_ids = list({str(c['review_id']) for c in comments})
    reviews = {}
    if review_ids:
        r = (
            get_supabase_client().table('summary_reviews')
            .select('id, template_name, summary, created_at')
            .in_('id', review_ids)
            .execute()
        )
        reviews = {str(row['id']): row for row in (r.data or [])}
    out = []
    for c in comments:
        review = reviews.get(str(c['review_id']), {})
        out.append({
            **c,
            'template_name': review.get('template_name'),
            'summary': review.get('summary'),
            'reviewed_at': review.get('created_at'),
        })
    return out


def list_user_comments(user_id: str) -> list[dict[str, Any]]:
    """A user's own comments, newest first."""
    r = (
        get_supabase_client().table('summary_comments')
        .select(COMMENT_COLUMNS)
        .eq('user_id', user_id)
        .order('created_at', desc=True)
        .execute()
    )
    return _with_reviews([dict(row) for row in (r.data or [])])


def list_feedback(status: str = 'open') -> dict[str, Any]:
    """Every comment (filtered by status: one of STATUSES) with the author's email, plus review counts."""
    supabase = get_supabase_client()
    q = supabase.table('summary_comments').select(COMMENT_COLUMNS)
    if status == 'open':
        q = q.is_('resolved_at', 'null')
    elif status == 'resolved':
        q = q.not_.is_('resolved_at', 'null')
    comments = _with_reviews([dict(row) for row in (q.order('created_at', desc=True).execute().data or [])])

    user_ids = list({str(c['user_id']) for c in comments})
    emails = {}
    if user_ids:
        r = supabase.table('users').select('id, email, display_name').in_('id', user_ids).execute()
        emails = {str(u['id']): u for u in (r.data or [])}
    for c in comments:
        author = emails.get(str(c['user_id']), {})
        c['user_email'] = author.get('email')
        c['user_display_name'] = author.get('display_name')

    outcomes = [row['outcome'] for row in (supabase.table('summary_reviews').select('outcome').execute().data or [])]
    return {
        'comments': comments,
        'stats': {
            'reviews': len(outcomes),
            'with_feedback': outcomes.count('feedback'),
            'no_feedback': outcomes.count('no_feedback'),
        },
    }


def get_comment(comment_id: str) -> Optional[dict[str, Any]]:
    try:
        uuid.UUID(comment_id)
    except ValueError:
        return None  # Not a UUID; querying would make Postgres raise.
    r = get_supabase_client().table('summary_comments').select(COMMENT_COLUMNS).eq('id', comment_id).limit(1).execute()
    return dict(r.data[0]) if r.data else None


def set_resolved(comment_id: str, resolved: bool, admin_user_id: Optional[str]) -> Optional[dict[str, Any]]:
    """Mark a comment resolved (or open again). Returns the updated comment, or None if it doesn't exist."""
    if not get_comment(comment_id):
        return None
    values = (
        {'resolved_at': datetime.now(timezone.utc).isoformat(), 'resolved_by': admin_user_id}
        if resolved else {'resolved_at': None, 'resolved_by': None}
    )
    get_supabase_client().table('summary_comments').update(values).eq('id', comment_id).execute()
    return get_comment(comment_id)
