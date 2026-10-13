"""Story content the checker used to miss (B1-B4 in docs/PLAN-v2-refactor.md). B1, B2 and B4 were fixed in PR 2.3; B3
(objects placed in text) is fixed in PR 2.4.

Each case builds the same content twice: placed plainly (the control, which passes today) and nested the way
InDesign writes it. A nested form not handled yet is marked xfail(strict=True), so when it's fixed the test
XPASSes and fails until the mark is removed. Decided with River (2026-10-13): notes and pending deletions are
skipped; footnotes and table cells are checked as text. (Frontify itself drops all of these; see "Possible
future checks" in docs/checker-rules.md.)
"""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

NOT_YET = 'fixed in PR 2.4 (docs/PLAN-v2-refactor.md)'


def para(style, inner):
    return f'<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/{style}">{inner}</ParagraphStyleRange>'


def run(inner, style='$ID/[No character style]'):
    return f'<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/{style}">{inner}</CharacterStyleRange>'


def content(text):
    return f'<Content>{text}</Content>'


def check(tmp_path, build):
    """build(pkg) adds content; returns the checker run."""
    pkg = PackageBuilder()
    pkg.paragraph_style('Heading', KerningMethod='$ID/Optical')
    pkg.character_style('Emphasis', KerningMethod='$ID/Optical')
    build(pkg)
    return run_checker(pkg.write(tmp_path))


def frame_text(tmp_path, body):
    """The text the checker reads from a two-column frame holding this story (two columns gives the frame a
    text box issue, which is what puts its text in the results)."""
    result = check(tmp_path, lambda pkg: pkg.text_frame(pkg.raw_story(body), columns=2))
    return result, ''.join(box['content'] for box in result.results['text_box_data'].values())


# --- B1/B2: text and runs inside hyperlinks, tracked changes, tags and special characters -----------------

@pytest.mark.parametrize('body', [
    pytest.param(para('Body', run(content('Visit us'))), id='plain'),
    pytest.param(para('Body', run('<HyperlinkTextSource Self="h1" Name="Website" Hidden="false">'
                                  f'{content("Visit us")}</HyperlinkTextSource>')),
                 id='hyperlink'),
    pytest.param(para('Body', run(f'<Change Self="c1" ChangeType="InsertedText">{content("Visit us")}</Change>')),
                 id='tracked-insertion'),
    pytest.param(para('Body', f'<XMLElement Self="x1" MarkupTag="XMLTag/span">{run(content("Visit us"))}</XMLElement>'),
                 id='tagged-run'),
])
def test_frame_text_is_read(tmp_path, body):
    result, text = frame_text(tmp_path, body)
    assert 'Visit us' in text
    assert result.of('EMPTY_TEXT_FRAME') == []


def test_text_after_a_special_character_is_read(tmp_path):
    # <?ACE 18?> is InDesign's current page number marker.
    _, text = frame_text(tmp_path, para('Body', run('<Content>Page <?ACE 18?> of 5</Content>')))
    assert text.startswith('Page ') and text.rstrip().endswith(' of 5')


def test_pending_deletion_is_not_text(tmp_path):
    _, text = frame_text(tmp_path, para('Body', run(content('Kept ')) +
                                        run(f'<Change Self="c1" ChangeType="DeletedText">{content("gone")}</Change>')))
    assert 'Kept' in text and 'gone' not in text


@pytest.mark.parametrize('body', [
    pytest.param(para('Body', run(content('Hello'), 'Emphasis')), id='plain'),
    pytest.param(para('Body', f'<XMLElement Self="x1" MarkupTag="XMLTag/span">{run(content("Hello"), "Emphasis")}</XMLElement>'),
                 id='tagged-run'),
])
def test_character_style_of_a_run_is_checked(tmp_path, body):
    result = check(tmp_path, lambda pkg: pkg.text_frame(pkg.raw_story(body)))
    assert [(i.classifier, i.identifier) for i in result.of('KERNING_CHAR')] == [('KERNING_CHAR', 'Emphasis')]


# --- B3: inline and anchored objects ------------------------------------------------------------------------

def _inline_image(**image):
    def build(pkg):
        pkg.text_frame(pkg.raw_story(para('Body', run(content('See ')) + run(pkg.inline_image('photo.jpg', **image)))))
    return build


def _image_on_page(**image):
    def build(pkg):
        pkg.text_frame(pkg.story([('Body', 'See')]))
        pkg.image('photo.jpg', **image)
    return build


@pytest.mark.parametrize('build', [
    pytest.param(_image_on_page(), id='on-page'),
    pytest.param(_inline_image(), id='inline', marks=pytest.mark.xfail(strict=True, reason=f'B3: {NOT_YET}')),
])
def test_placed_image_is_not_unused(tmp_path, build):
    assert check(tmp_path, build).of('UNUSED_IMAGE') == []


@pytest.mark.parametrize('build', [
    pytest.param(_image_on_page(image_transform='-1 0 0 1 0 0'), id='on-page'),
    pytest.param(_inline_image(image_transform='-1 0 0 1 0 0'), id='inline',
                 marks=pytest.mark.xfail(strict=True, reason=f'B3: {NOT_YET}')),
])
def test_flipped_image_is_reported(tmp_path, build):
    assert len(check(tmp_path, build).of('IMAGE_TRANSFORMATION_IMAGE')) == 1


def _anchored_frame(pkg):
    inner = pkg.story([('Body', 'Inside')])
    pkg.text_frame(pkg.raw_story(para('Body', run(content('Host ') + pkg.anchored_text_frame(inner, columns=2)))))


def _frame_on_page(pkg):
    pkg.text_frame(pkg.story([('Body', 'Host')]))
    pkg.text_frame(pkg.story([('Body', 'Inside')]), columns=2)


@pytest.mark.parametrize('build', [
    pytest.param(_frame_on_page, id='on-page'),
    pytest.param(_anchored_frame, id='anchored', marks=pytest.mark.xfail(strict=True, reason=f'B3: {NOT_YET}')),
])
def test_frame_checks_see_the_frame(tmp_path, build):
    assert len(check(tmp_path, build).of('TEXT_COLUMNS')) == 1


# --- B4: notes, footnotes and table cells (paragraphs inside a run) ------------------------------------------

def _heading_inside(wrap):
    """Body text with a Heading paragraph (Optical kerning, so it's flagged when checked) inside wrap."""
    heading = para('Heading', run(content('Inner')))
    return lambda pkg: pkg.text_frame(pkg.raw_story(para('Body', run(content('Body ') + wrap(heading)))))


TABLE = ('<Table Self="t1" HeaderRowCount="0" FooterRowCount="0" BodyRowCount="1" ColumnCount="1">'
         '<Row Self="t1Row0" Name="0"/><Column Self="t1Column0" Name="0"/>'
         '<Cell Self="t1i0i0" Name="0:0" RowSpan="1" ColumnSpan="1">{}</Cell></Table>')


@pytest.mark.parametrize('build', [
    pytest.param(lambda pkg: pkg.text_frame(pkg.story([('Body', 'Body'), ('Heading', 'Inner')])), id='body-paragraph'),
    pytest.param(_heading_inside('<Footnote>{}</Footnote>'.format), id='footnote'),
    pytest.param(_heading_inside(TABLE.format), id='table-cell'),
])
def test_paragraph_is_checked(tmp_path, build):
    assert [i.identifier for i in check(tmp_path, build).of('KERNING')] == ['Heading']


def test_note_is_not_checked(tmp_path):
    assert check(tmp_path, _heading_inside('<Note>{}</Note>'.format)).of('KERNING') == []
