"""src/model/text.py: one recursive walk over the story XML (plan PR 2.3, B1, B2, B4, B6)."""
from lxml import etree

from src.model.text import read_story

NO_STYLE = 'CharacterStyle/$ID/[No character style]'


def story(body):
    return read_story(etree.fromstring(f'<Story Self="s1">{body}</Story>'))


def para(inner, style='Body', **attrs):
    extra = ''.join(f' {k}="{v}"' for k, v in attrs.items())
    return f'<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/{style}"{extra}>{inner}</ParagraphStyleRange>'


def run(inner, style=NO_STYLE):
    return f'<CharacterStyleRange AppliedCharacterStyle="{style}">{inner}</CharacterStyleRange>'


def texts(s):
    return [(p.style.split('/')[-1], p.container, p.text) for p in s.paragraphs]


def test_plain_paragraphs():
    s = story(para(run('<Content>Hello</Content>')) + para(run('<Content>World</Content>'), style='Head'))
    assert s.id == 's1'
    assert texts(s) == [('Body', 'body', 'Hello'), ('Head', 'body', 'World')]


def test_runs_inside_hyperlinks_tags_and_insertions_are_kept():
    s = story(para(
        '<XMLElement Self="x1">' + run('<Content>A</Content>') + '</XMLElement>'
        + '<HyperlinkTextSource Self="h1">' + run('<Content>B</Content>') + '</HyperlinkTextSource>'
        + run('<HyperlinkTextSource Self="h2"><Content>C</Content></HyperlinkTextSource>')
        + run('<Change Self="c1" ChangeType="InsertedText"><Content>D</Content></Change>')))
    assert [r.text for r in s.paragraphs[0].runs] == ['A', 'B', 'C', 'D']


def test_paragraphs_inside_tags_are_kept():
    assert texts(story('<XMLElement Self="x1">' + para(run('<Content>Tagged</Content>')) + '</XMLElement>')) == \
        [('Body', 'body', 'Tagged')]


def test_pending_deletions_are_left_out():
    s = story(para(run('<Content>Kept</Content><Change Self="c1" ChangeType="DeletedText"><Content>gone</Content></Change>')
                   + '<Change Self="c2" ChangeType="DeletedText">' + run('<Content>gone too</Content>') + '</Change>'))
    assert [r.text for r in s.paragraphs[0].runs] == ['Kept']


def test_text_around_special_characters_is_kept():
    assert story(para(run('<Content>Page <?ACE 18?> of 5</Content>'))).paragraphs[0].text == 'Page  of 5'


def test_paragraphs_in_cells_footnotes_and_notes_keep_their_container_and_order():
    cell = ('<Table Self="t1"><Cell Self="t1i0" Name="0:0">' + para(run('<Content>Cell</Content>'), style='TableText')
            + '</Cell></Table>')
    s = story(para(run('<Content>Before </Content>' + cell)
                   + run('<Footnote>' + para(run('<Content>Foot</Content>'), style='Note') + '</Footnote>')
                   + run('<Note>' + para(run('<Content>Editor</Content>'), style='Note') + '</Note><Content> after</Content>'))
              + para(run('<Content>Next</Content>')))
    assert texts(s) == [('Body', 'body', 'Before  after'), ('TableText', 'table', 'Cell'), ('Note', 'footnote', 'Foot'),
                        ('Note', 'note', 'Editor'), ('Body', 'body', 'Next')]
    assert [r.has_table for r in s.paragraphs[0].runs] == [True, False, False]


def test_page_items_placed_in_a_run_are_collected():
    image = ('<Rectangle Self="r1" ItemTransform="-1 0 0 1 0 0"><Image Self="i1">'
             '<Link Self="l1" LinkResourceURI="file:/Links/photo%20one.jpg" StoredState="Normal"/></Image></Rectangle>')
    frame = '<TextFrame Self="f1" ParentStory="s2" PreviousTextFrame="n" NextTextFrame="n"><TextFramePreference TextColumnCount="2"/></TextFrame>'
    r = story(para(run('<Content>See </Content>' + image + frame))).paragraphs[0].runs[0]
    assert r.text == 'See '
    assert [(i.kind, i.id, i.transform) for i in r.items] == [('Rectangle', 'r1', '-1 0 0 1 0 0'), ('TextFrame', 'f1', None)]
    assert r.items[1].columns == '2' and r.items[1].story_id == 's2'
    assert [(l.id, l.name, l.frame_id) for l in r.links] == [('l1', 'photo one.jpg', 'r1')]


def test_formatting_set_on_text():
    # B6: a run's Properties are read even when the range has no attributes.
    s = story(para('<CharacterStyleRange><Properties><AppliedFont type="string">Arial</AppliedFont></Properties>'
                   '<Content>x</Content></CharacterStyleRange>'
                   + run('<Content>y</Content>').replace('">', '" PointSize="12">', 1), Justification='CenterAlign'))
    p = s.paragraphs[0]
    assert p.attrs == {'Justification': 'CenterAlign'}
    assert [(r.style, dict(r.attrs), dict(r.properties)) for r in p.runs] == [
        (None, {}, {'AppliedFont': 'Arial'}), (NO_STYLE, {'PointSize': '12'}, {})]


def test_line_breaks_are_newlines():
    assert story(para(run('<Content>Trim: 8.5x11</Content><Br /><Content>Finish</Content>'))).paragraphs[0].text == \
        'Trim: 8.5x11\nFinish'
