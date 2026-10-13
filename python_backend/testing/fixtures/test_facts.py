"""Checks record what they found as facts, so nothing has to read it back out of the message (plan PR 4.1, §4.3)."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def facts(tmp_path, build, check, kind=None):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    build(pkg)
    return [i.facts for i in run_checker(pkg.write(tmp_path)).of(check, kind)]


def test_auto_size(tmp_path):
    assert facts(tmp_path, lambda pkg: pkg.text_frame(pkg.story([('Body', 'Wide')]), auto_size='WidthOnly',
                                                      no_line_breaks=False), 'AUTO_SIZE_TEXT_BOX') == \
        [{'auto_size': 'WidthOnly', 'no_line_breaks': False}]


def test_large_image(tmp_path):
    assert facts(tmp_path, lambda pkg: pkg.image('big.jpg', size_bytes=11 * 1024 ** 2), 'LARGE_IMAGE') == \
        [{'size_mb': 11.0}]


def test_master_page_elements_keep_their_order(tmp_path):
    def build(pkg):
        pkg.image('a.jpg', master=0)
        pkg.image('b.jpg', master=0)
    assert facts(tmp_path, build, 'MASTERPAGE') == [{'elements': [{'kind': 'Rectangle', 'count': 2}]}]


def test_bleed_can_be_negative(tmp_path):
    def build(pkg):
        pkg.bleed = '-3'
    assert facts(tmp_path, build, 'DOCUMENT_BLEED') == [{'bleed': {'top': -3.0, 'bottom': -3.0, 'inside': -3.0, 'outside': -3.0}}]


def test_unstyled_text_that_is_only_whitespace(tmp_path):
    story = [('Body', 'Hello'), ('$ID/[No paragraph style]', '   ')]
    assert facts(tmp_path, lambda pkg: pkg.text_frame(pkg.story(story)), 'PARAGRAPH_STYLE') == \
        [{'whole_frame': False, 'whitespace_only': True}]


def test_flip_and_skew(tmp_path):
    def build(pkg):
        pkg.image('a.jpg', frame_transform='-1 0 0 1 300 0')
        pkg.shape('Oval', transform='0.9659258 0.2588190 0.2 1 0 0')  # skewed and turned 15 degrees
    assert facts(tmp_path, build, 'TRANSFORMATION', 'image_frame') == [{'kind': 'flip', 'rotation_deg': None}]
    assert facts(tmp_path, build, 'TRANSFORMATION', 'page_item') == [{'kind': 'skew', 'rotation_deg': 15.0}]
