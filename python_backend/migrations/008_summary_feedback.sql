-- Migration: Feedback on the customer summary while it's in beta.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).
--
-- Every time an agent copies a customer summary they review it first. Each copy is one summary_reviews row
-- (with a snapshot of the exact text they saw); any comments they left are summary_comments rows pointing at it.
-- Admins read all of it on the Summary feedback page; agents only ever see their own comments.

CREATE TABLE IF NOT EXISTS summary_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    -- The summary exactly as reviewed, so comments still make sense after the wording changes.
    summary TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('no_feedback', 'feedback')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_summary_reviews_user_id ON summary_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_reviews_created_at ON summary_reviews(created_at DESC);

CREATE TABLE IF NOT EXISTS summary_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES summary_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Which part of the summary: 'intro', 'closing', 'general', or an issue's validation type (e.g. FONTS_INCLUDED).
    section_key TEXT NOT NULL,
    section_title TEXT,
    -- Optional quoted text and its character offsets within summary_reviews.summary.
    quote TEXT,
    quote_start INTEGER,
    quote_end INTEGER,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CHECK (
        (quote IS NULL AND quote_start IS NULL AND quote_end IS NULL)
        OR (quote IS NOT NULL AND quote_start >= 0 AND quote_end > quote_start)
    )
);
CREATE INDEX IF NOT EXISTS idx_summary_comments_review_id ON summary_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_summary_comments_user_id ON summary_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_comments_open ON summary_comments(created_at DESC) WHERE resolved_at IS NULL;

-- The backend uses the service role key; no client should read these tables directly.
ALTER TABLE summary_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_comments ENABLE ROW LEVEL SECURITY;
