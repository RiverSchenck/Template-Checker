"""The check list is part of the contract: analytics stores each check's state name (runs.stopped_at_stage)
and the frontend labels them, and results depend on the order checks run in."""
from src.checks import CHECKS
from src.classes.States import States

EXPECTED_ORDER = [
    'MASTERPAGE_CHECK', 'PAR_CHECK', 'HYPHENATION_CHECK', 'OVERRIDES_CHECK', 'KERNING_CHECK',
    'FONTS_INCLUDED_CHECK', 'ADOBE_FONT_CHECK', 'OTF_TTF_FONT_CHECK', 'VARIABLE_FONT_CHECK',
    'IMAGES_INCLUDED_CHECK', 'LARGE_IMAGE_CHECK', 'EMBEDDED_IMAGE_CHECK', 'IMAGE_TRANSFORMATION_CHECK',
    'PAGE_ITEM_TRANSFORMATION_CHECK', 'TABLE_CHECK', 'PASTED_GRAPHICS_CHECK', 'DOCUMENT_BLEED_CHECK',
    'AUTO_SIZE_TEXT_BOX_CHECK', 'TEXT_COLUMNS_CHECK', 'TEXT_WRAP_CHECK', 'LINKED_TEXT_FRAME_CHECK',
    'OBJECT_STYLE_CHECK', 'GRID_ALIGNMENT_CHECK', 'COMPOSER_CHECK', 'OTHER_CHECKS', 'POSITION_CHECK',
]


def test_checks_run_in_the_established_order():
    assert [c.state.name for c in CHECKS] == EXPECTED_ORDER


def test_every_check_state_has_exactly_one_check():
    check_states = {s for s in States if s.name.endswith('_CHECK') or s.name == 'OTHER_CHECKS'}
    assert sorted(s.name for s in check_states) == sorted(c.state.name for c in CHECKS)


def test_only_checks_that_read_stories_are_skipped_without_them():
    assert {c.state.name for c in CHECKS if c.needs_stories} == {
        'PAR_CHECK', 'HYPHENATION_CHECK', 'OVERRIDES_CHECK', 'KERNING_CHECK', 'TABLE_CHECK',
        'GRID_ALIGNMENT_CHECK', 'COMPOSER_CHECK', 'OTHER_CHECKS', 'POSITION_CHECK'}
