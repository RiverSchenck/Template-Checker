-- Migration: analytics on results v2 (docs/archive/PLAN-v2-refactor.md PR 5.4, decision D4), step 2 of 2.
--
-- Run AFTER the backend that writes results v2 keys is deployed (011_results_v2.sql ran before it).
-- Rewrites what the old backend wrote while the deploy rolled out, then lets `validations.category` hold subject
-- kinds only. Safe to run more than once.

BEGIN;

DO $$
BEGIN
    IF to_regprocedure('results_v2_rewrite_validations()') IS NOT NULL THEN
        RAISE NOTICE 'rows rewritten: %', results_v2_rewrite_validations();
    END IF;
END $$;

ALTER TABLE validations DROP CONSTRAINT IF EXISTS validations_category_check;
ALTER TABLE validations ADD CONSTRAINT validations_category_check CHECK (category IN (
    'paragraph_style', 'character_style', 'text_frame', 'image', 'image_frame', 'font', 'page_item', 'document'));

DROP FUNCTION IF EXISTS results_v2_rewrite_validations();

COMMIT;
