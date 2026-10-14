"""What the customer summary says, on small hand-built results. The goldens cover real packages."""
import re

from app.customer_summary import build_customer_summary, summary_payload
from app.customer_summary.report import format_pages
from src.results.catalogue import BY_KEY
from src.results.serialize import check_json

# The checks as results v2 lists them (the catalogue's wording), with made-up help links.
CHECKS = [{**check_json(BY_KEY[key]), 'help_article': help_article} for key, help_article in [
    ('KERNING', 'https://help/kerning'), ('AUTO_SIZE_TEXT_BOX', None), ('FONTS_INCLUDED', None), ('COMPOSER', None),
    ('TABLE', None)]]


def style(name):
    return {'kind': 'paragraph_style', 'id': f'ParagraphStyle/{name}', 'name': name}


def frame(frame_id):
    return {'kind': 'text_frame', 'id': frame_id, 'name': None}


def issue(check='KERNING', severity='error', subject=None, item_id=None, page_id='p1', page_name='1', bounds=None,
          facts=None, text=None, detail=None):
    """An issue in results v2."""
    return {'check': check, 'severity': severity, 'subject': subject or {'kind': 'document', 'id': None, 'name': None},
            'location': {'page_id': page_id, 'page_name': page_name, 'spread_id': 's1', 'item_id': item_id,
                         'bounds': bounds},
            'facts': facts, 'text': text, 'detail': detail}


def bounds(page_id, y):
    return {'page_id': page_id, 'kind': 'TextFrame', 'x': 10, 'y': y, 'width': 100, 'height': 20}


def make_result(**overrides):
    return {
        'schema_version': 2,
        'template_name': 'Sample',
        'issues': [
            issue(subject=style('Headline'), item_id='f1', text=['Big title'], bounds=bounds('p1', 10)),
            issue(subject=style('Headline'), item_id='f2', page_id='p2', page_name='2', bounds=bounds('p2', 10)),
            issue(subject=style('Headline'), item_id='f3', page_id='p3', page_name='3', bounds=bounds('p3', 10)),
            issue('COMPOSER', 'warning', style('Headline'), item_id='f1', bounds=bounds('p1', 10)),
            issue(subject=style('Body'), item_id='f4', bounds=bounds('p1', 50)),
            issue('AUTO_SIZE_TEXT_BOX', subject=frame('f5'), item_id='f5', detail="'No Line Breaks' must be checked.",
                  bounds=bounds('p1', 80), facts={'auto_size': 'WidthOnly', 'no_line_breaks': False}),
            issue('FONTS_INCLUDED', subject={'kind': 'font', 'id': 'Pangea Bold', 'name': 'Pangea Bold'}, page_id=None,
                  page_name=None),
        ],
        'subjects_checked': {'paragraph_style': 4, 'text_frame': 6},
        'pages': [{'id': p, 'name': str(i + 1), 'index': i + 1, 'spread_id': 's1', 'width': 600, 'height': 400,
                   'preview': None, 'frames': []} for i, p in enumerate(['p1', 'p2', 'p3'])],
        'text_boxes': {'f5': {'content': 'AI-generated', 'page_id': 'p1'}},
        'checks': CHECKS,
        **overrides,
    }


def test_lists_blockers_with_why_where_and_how_without_internal_ids():
    text = build_customer_summary(make_result()).review_text

    assert ('Our review of “Sample” found 3 likely causes of the problems in Frontify and 1 possible contributing '
            'factor. The recommended changes are below.') in text
    assert 'Likely causes\n\n1. Kerning isn’t set to Metrics\nFrontify spaces letters' in text
    assert 'Where: paragraph styles “Headline” and “Body”, used on pages 1–3' in text
    assert '• In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.' in text
    assert 'Where: the text frame “AI-generated” (page 1, turn on No Line Breaks)' in text
    assert '\nLearn more\n' in text
    # Numbering continues across groups so the customer can refer to an item by number.
    assert 'Possible contributing factors\n\n4. Paragraph Composer used' in text
    assert 'upload it to Frontify' in text
    assert not re.search(r'\bf[1-5]\b|KERNING|story1', text)


def test_lists_the_same_frame_on_several_pages_once_and_drops_the_file_extension():
    frames = [issue('AUTO_SIZE_TEXT_BOX', subject=frame(f'f-{p}'), item_id=f'f-{p}', page_id=p, bounds=bounds(p, 80))
              for p in ('p1', 'p2', 'p3')]
    text = build_customer_summary(make_result(
        template_name='Sample.zip', issues=frames,
        text_boxes={f'f-{p}': {'content': 'AI-generated', 'page_id': p} for p in ('p1', 'p2', 'p3')},
    )).review_text

    assert 'Our review of “Sample” found 1 likely cause of the problems in Frontify.' in text
    assert 'Where: the text frame “AI-generated” (pages 1–3)' in text
    assert 'Likely causes\n' not in text  # a single group needs no heading


def test_names_frames_on_the_same_page_once_and_puts_checker_details_in_plain_words():
    text = build_customer_summary(make_result(
        issues=[
            issue('COMPOSER', 'warning', {'kind': 'paragraph_style', 'id': 'ParagraphStyle/$ID/NormalParagraphStyle',
                                          'name': 'NormalParagraphStyle'}, bounds=bounds('p1', 10)),
            *(issue('OVERRIDE', 'warning', frame(sid), item_id=sid, bounds=bounds('p1', 10)) for sid in ('s1', 's2')),
            issue('DOCUMENT_BLEED', 'warning', page_id=None, page_name=None,
                  detail='top: 8.503937007874017pt, bottom: 8.503937007874017pt, inside: 8.503937007874017pt, '
                         'outside: 8.503937007874017pt.',
                  facts={'bleed': {side: 8.503937007874017 for side in ('top', 'bottom', 'inside', 'outside')}}),
        ],
        text_boxes={'s1': {'content': 'Title', 'page_id': 'p1'}, 's2': {'content': 'Intro', 'page_id': 'p1'}},
        checks=[],
    )).review_text

    assert 'Where: text frames “Intro”, “Title” (page 1)' in text
    assert 'Where: the paragraph style “[Basic Paragraph]”, used on page 1' in text
    assert 'Current bleed: 3 mm on all sides' in text
    assert not re.search(r'8\.50|NormalParagraphStyle', text)


def test_says_which_formatting_was_overridden_in_indesigns_words():
    override = lambda o: issue('OVERRIDE', 'warning', frame('f5'), item_id='f5', bounds=bounds('p1', 80),
                               facts={'overrides': o})
    text = build_customer_summary(make_result(
        issues=[override({'AppliedFont': 'Arial', 'MiterLimit': '4'}), override({'FontStyle': 'Bold', 'PointSize': '12'})],
    )).review_text

    assert 'Where: the text frame “AI-generated” (page 1, font and size changed)' in text
    assert '• To remove it, select the text and click Clear Overrides' in text


def test_covers_warning_only_templates_and_lists_infos_as_worth_a_check():
    text = build_customer_summary(make_result(
        issues=[issue('COMPOSER', 'warning', style('Headline'), item_id='f1', bounds=bounds('p1', 10)),
                issue('EMPTY_TEXT_FRAME', 'info', frame('f5'), item_id='f5', bounds=bounds('p1', 80))],
    )).review_text

    assert ('Our review of “Sample” found 1 possible contributing factor to the problems in Frontify. '
            'The recommended changes are below.') in text
    assert 'Worth a quick check (often fine as is)\n\n2. Empty text frame' in text
    assert 'Once that’s done, package the document again' in text


def test_nothing_found_is_a_single_intro():
    summary = build_customer_summary({'template_name': 'Clean.zip'})

    assert [s.key for s in summary.sections] == ['intro']
    assert summary.review_text == ('Our review of “Clean” found nothing in the InDesign file that is likely to cause '
                                   'problems in Frontify.')
    assert summary.counts == {'errors': 0, 'warnings': 0, 'infos': 0}


def test_html_for_intercom_escapes_text_and_links_help_articles():
    html = build_customer_summary(make_result(template_name='A <b> & “quotes”')).html

    assert '<p><strong>Likely causes</strong></p>' in html
    assert '<p><strong>1. Kerning isn’t set to Metrics</strong><br>Frontify spaces letters' in html
    assert '<ul><li>In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.</li></ul>' in html
    assert '<a href="https://help/kerning">Learn more</a>' in html
    assert 'A &lt;b&gt; &amp; “quotes”' in html
    assert set(re.findall(r'</?(\w+)', html)) <= {'p', 'br', 'strong', 'ul', 'li', 'a'}  # what Intercom keeps


def test_review_text_plain_text_and_html_say_the_same_thing():
    summary = build_customer_summary(make_result())

    assert 'https://help/kerning' not in summary.review_text
    assert 'Learn more: https://help/kerning' in summary.plain_text
    assert re.sub(r'Learn more: \S+', 'Learn more', summary.plain_text) == summary.review_text
    html_text = re.sub(r'<[^>]+>', '', re.sub(r'<br>|</p>|</li>', ' ', summary.html.replace('<li>', '• ')))
    html_text = html_text.replace('&gt;', '>').replace('&lt;', '<').replace('&quot;', '"').replace('&amp;', '&')
    assert ' '.join(html_text.split()) == ' '.join(summary.review_text.split())


def test_sections_carry_the_structure_the_web_app_reviews():
    summary = build_customer_summary(make_result())
    payload = summary_payload(summary, include_sections=True)

    assert payload['counts'] == {'blockers': 3, 'warnings': 1, 'infos': 0}
    assert payload['text'] == summary.plain_text
    sections = payload['sections']
    assert sections[0]['key'] == 'intro' and sections[-1]['key'] == 'closing'
    issues = [s for s in sections if s['problem_id']]
    assert [s['problem_id'] for s in issues] == ['errors:KERNING', 'errors:AUTO_SIZE_TEXT_BOX', 'errors:FONTS_INCLUDED',
                                                'warnings:COMPOSER']
    assert issues[0]['lines'][0] == {'kind': 'title', 'text': '1. Kerning isn’t set to Metrics'}
    assert issues[0]['lines'][-1] == {'kind': 'link', 'text': 'Learn more', 'href': 'https://help/kerning'}
    assert 'sections' not in summary_payload(summary, include_sections=False)


def test_format_pages():
    assert format_pages(['1', '2', '3', '5', '7', '8']) == '1–3, 5, 7–8'
    assert format_pages(['A', 'B']) == 'A, B'
    assert format_pages([]) == ''
