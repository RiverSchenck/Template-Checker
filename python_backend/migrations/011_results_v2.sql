-- Migration: analytics on results v2 (docs/archive/PLAN-v2-refactor.md PR 5.4, decision D4), step 1 of 2.
--
-- Run BEFORE deploying the backend that writes results v2 keys; run 012_results_v2_finish.sql AFTER that deploy.
-- Between the two, `validations.category` accepts both the old sections and the new subject kinds, so neither the
-- old nor the new backend loses a run's issues while the deploy rolls out.
--
-- What it does:
--   1. Backs up (id, validation_type, category) of every validation into validations_backup_011. Drop it once the
--      analytics page looks right: DROP TABLE validations_backup_011;
--   2. Widens the category CHECK to old sections + subject kinds.
--   3. Rewrites rows still in v1 terms (category is an old section) with results_v2_rewrite_validations():
--      - each current v1 classifier, at its own severity, gets its v2 check key (the merged checks of plan §3.1:
--        TEXT_WRAP_ITEM -> TEXT_WRAP, OBJECT_STYLE_TEXT/_IMAGE -> OBJECT_STYLE, IMAGE_TRANSFORMATION_IMAGE/
--        _CONTAINER and PAGE_ITEM_TRANSFORMATION -> TRANSFORMATION, PARAGRAPH_STYLE_TEXT_BOX -> PARAGRAPH_STYLE)
--        and the kind of thing it's about as category (python_backend/src/results/catalogue.py V1_KEYS);
--      - retired types keep their name (IMAGE_TRANSFORMATION, FOLDER, and the rotation warnings, which were stored
--        under the transformation names with severity 'warning'); their category becomes the kind matching their
--        old section.
--   Old `identifier` values are left as they are.
--
-- Safe to run more than once: rows already rewritten have a subject kind as category and aren't touched again.
-- testing/unit_tests/analytics/test_migration_011.py checks the mapping below against the catalogue.

BEGIN;

CREATE TABLE IF NOT EXISTS validations_backup_011 AS
    SELECT id, validation_type, category FROM validations;
ALTER TABLE validations_backup_011 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON validations_backup_011 FROM PUBLIC, anon, authenticated;

-- The category CHECK, whatever it was named when the table was created.
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.validations'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%category%'
    LOOP
        EXECUTE format('ALTER TABLE validations DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE validations ADD CONSTRAINT validations_category_check CHECK (category IN (
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general',
    'paragraph_style', 'character_style', 'text_frame', 'image', 'image_frame', 'font', 'page_item', 'document'));

-- Rows rewritten, by both steps. Dropped by 012.
CREATE OR REPLACE FUNCTION results_v2_rewrite_validations()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    mapped INTEGER;
    retired INTEGER;
BEGIN
    -- v1 classifier at its severity -> (v2 check, subject kind).
    WITH v1 (validation_type, severity, check_key, kind) AS (VALUES
        ('ERROR', 'error', 'ERROR', 'document'),
        ('IDML', 'error', 'IDML', 'document'),
        ('ZIP', 'error', 'ZIP', 'document'),
        ('MASTERPAGE', 'error', 'MASTERPAGE', 'document'),
        ('PARAGRAPH_STYLE', 'error', 'PARAGRAPH_STYLE', 'text_frame'),
        ('PARAGRAPH_STYLE_TEXT_BOX', 'error', 'PARAGRAPH_STYLE', 'text_frame'),
        ('FONTS_INCLUDED', 'error', 'FONTS_INCLUDED', 'font'),
        ('OTF_TTF_FONT', 'error', 'OTF_TTF_FONT', 'font'),
        ('VARIABLE_FONT', 'error', 'VARIABLE_FONT', 'font'),
        ('IMAGE_INCLUDED', 'error', 'IMAGE_INCLUDED', 'image'),
        ('EMBEDDED_IMAGE', 'error', 'EMBEDDED_IMAGE', 'image'),
        ('IMAGE_TRANSFORMATION_IMAGE', 'error', 'TRANSFORMATION', 'image'),
        ('IMAGE_TRANSFORMATION_CONTAINER', 'error', 'TRANSFORMATION', 'image_frame'),
        ('PAGE_ITEM_TRANSFORMATION', 'error', 'TRANSFORMATION', 'page_item'),
        ('TABLE', 'error', 'TABLE', 'text_frame'),
        ('PASTED_GRAPHICS', 'error', 'PASTED_GRAPHICS', 'document'),
        ('AUTO_SIZE_TEXT_BOX', 'error', 'AUTO_SIZE_TEXT_BOX', 'text_frame'),
        ('TEXT_COLUMNS', 'error', 'TEXT_COLUMNS', 'text_frame'),
        ('LINKED_TEXT_FRAME', 'error', 'LINKED_TEXT_FRAME', 'text_frame'),
        ('OBJECT_STYLE_TEXT', 'error', 'OBJECT_STYLE', 'text_frame'),
        ('OBJECT_STYLE_IMAGE', 'error', 'OBJECT_STYLE', 'image'),
        ('GRID_ALIGNMENT', 'error', 'GRID_ALIGNMENT', 'paragraph_style'),
        ('KERNING', 'error', 'KERNING', 'paragraph_style'),
        ('KERNING_CHAR', 'error', 'KERNING_CHAR', 'character_style'),
        ('TEXT_WRAP', 'error', 'TEXT_WRAP', 'text_frame'),
        ('FILL_TINT', 'error', 'FILL_TINT', 'paragraph_style'),
        ('FILL_TINT_CHAR', 'error', 'FILL_TINT_CHAR', 'character_style'),
        ('TEXT_WRAP_ITEM', 'error', 'TEXT_WRAP', 'page_item'),
        ('TEXT_POSITION', 'error', 'TEXT_POSITION', 'character_style'),
        ('ADOBE_FONT', 'error', 'ADOBE_FONT', 'font'),
        ('WARNING', 'warning', 'WARNING', 'document'),
        ('HYPHENATION', 'warning', 'HYPHENATION', 'paragraph_style'),
        ('OVERRIDE', 'warning', 'OVERRIDE', 'text_frame'),
        ('UNUSED_IMAGE', 'warning', 'UNUSED_IMAGE', 'image'),
        ('DOCUMENT_BLEED', 'warning', 'DOCUMENT_BLEED', 'document'),
        ('COMPOSER', 'warning', 'COMPOSER', 'paragraph_style'),
        ('BASELINE_SHIFT', 'warning', 'BASELINE_SHIFT', 'character_style'),
        ('EMPTY_TEXT_FRAME', 'info', 'EMPTY_TEXT_FRAME', 'text_frame'),
        ('LARGE_IMAGE', 'info', 'LARGE_IMAGE', 'image')
    )
    UPDATE validations v
    SET validation_type = v1.check_key, category = v1.kind
    FROM v1
    WHERE v.validation_type = v1.validation_type AND v.severity = v1.severity
      AND v.category IN ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general');
    GET DIAGNOSTICS mapped = ROW_COUNT;

    -- Retired types (and anything else still in an old section): keep the name, take the section's kind.
    UPDATE validations
    SET category = CASE category
        WHEN 'par_styles' THEN 'paragraph_style'
        WHEN 'char_styles' THEN 'character_style'
        WHEN 'text_boxes' THEN 'text_frame'
        WHEN 'fonts' THEN 'font'
        WHEN 'images' THEN 'image'
        ELSE 'document'
    END
    WHERE category IN ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general');
    GET DIAGNOSTICS retired = ROW_COUNT;

    RETURN mapped + retired;
END;
$$;

REVOKE ALL ON FUNCTION results_v2_rewrite_validations() FROM PUBLIC, anon, authenticated;

SELECT results_v2_rewrite_validations() AS rows_rewritten;

COMMIT;
