"""Stage names are stored in analytics (runs.stopped_at_stage), so they must never change (plan D10)."""
from src.checks import CHECKS
from src.checks.stages import States

STORED_NAMES = [
    'UNZIP_PACKAGE', 'UNZIP_IDML', 'PARSE_XML',
    'MASTERPAGE_CHECK', 'PAR_CHECK', 'HYPHENATION_CHECK', 'KERNING_CHECK', 'OVERRIDES_CHECK', 'FONTS_INCLUDED_CHECK',
    'OTF_TTF_FONT_CHECK', 'VARIABLE_FONT_CHECK', 'IMAGES_INCLUDED_CHECK', 'LARGE_IMAGE_CHECK', 'EMBEDDED_IMAGE_CHECK',
    'IMAGE_TRANSFORMATION_CHECK', 'PAGE_ITEM_TRANSFORMATION_CHECK', 'TABLE_CHECK', 'AUTO_SIZE_TEXT_BOX_CHECK',
    'PASTED_GRAPHICS_CHECK', 'DOCUMENT_BLEED_CHECK', 'TEXT_COLUMNS_CHECK', 'TEXT_WRAP_CHECK', 'LINKED_TEXT_FRAME_CHECK',
    'OBJECT_STYLE_CHECK', 'GRID_ALIGNMENT_CHECK', 'COMPOSER_CHECK', 'OTHER_CHECKS', 'POSITION_CHECK', 'ADOBE_FONT_CHECK',
    'RESULTS',
]


def test_stage_names_never_change():
    assert [state.name for state in States] == STORED_NAMES


def test_each_value_is_its_name():
    assert all(state.value == state.name for state in States)


def test_every_check_has_its_own_stage():
    stages = [check.state for check in CHECKS]
    assert len(stages) == len(set(stages))
    assert set(stages) <= set(States) - {States.UNZIP_PACKAGE, States.UNZIP_IDML, States.PARSE_XML, States.RESULTS}
