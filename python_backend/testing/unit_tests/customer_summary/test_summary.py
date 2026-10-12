"""What the customer summary says, on small hand-built results. The goldens cover real packages."""
import re

from app.customer_summary import build_customer_summary, check_guides_payload, summary_payload
from app.customer_summary.report import format_pages

EMPTY = {'errors': [], 'warnings': [], 'infos': []}

CHECKS = [
    {'key': 'KERNING', 'severity': 'errors', 'label': 'Kerning', 'message': "Kerning must be 'Metrics'",
     'help_article': 'https://help/kerning', 'category': 'par_styles'},
    {'key': 'AUTO_SIZE_TEXT_BOX', 'severity': 'errors', 'label': 'Auto Sizing Text Box', 'message': 'Auto-size wrong',
     'help_article': None, 'category': 'text_boxes'},
    {'key': 'FONTS_INCLUDED', 'severity': 'errors', 'label': 'Fonts Included', 'message': 'Missing fonts',
     'help_article': None, 'category': 'fonts'},
    {'key': 'COMPOSER', 'severity': 'warnings', 'label': 'Composer', 'message': 'Use single-line',
     'help_article': None, 'category': 'par_styles'},
    {'key': 'TABLE', 'severity': 'errors', 'label': 'Table', 'message': 'No tables', 'help_article': None,
     'category': 'text_boxes'},
]


def item(**overrides):
    return {'validationClassifier': 'KERNING', 'context': '', 'identifier': 'null', 'page_id': 'p1', 'page_name': '1',
            'spread_id': 's1', 'data_id': 'null', **overrides}


def category(details, total_count=0):
    return {'details': details, 'total_count': total_count}


def bounds(page_id, y):
    return {'page_id': page_id, 'kind': 'TextFrame', 'x': 10, 'y': y, 'width': 100, 'height': 20}


def make_result(**overrides):
    return {
        'template_name': 'Sample',
        'par_styles': category({
            'Headline': {**EMPTY,
                         'errors': [item(identifier='Headline', data_id='f1', text_content=['Big title'], bounds=bounds('p1', 10)),
                                    item(identifier='Headline', data_id='f2', page_id='p2', page_name='2', bounds=bounds('p2', 10)),
                                    item(identifier='Headline', data_id='f3', page_id='p3', page_name='3', bounds=bounds('p3', 10))],
                         'warnings': [item(validationClassifier='COMPOSER', identifier='Headline', data_id='f1', bounds=bounds('p1', 10))]},
            'Body': {**EMPTY, 'errors': [item(identifier='Body', data_id='f4', bounds=bounds('p1', 50))]},
        }, 4),
        'char_styles': category({}),
        'text_boxes': category({
            'story1': {**EMPTY, 'errors': [item(validationClassifier='AUTO_SIZE_TEXT_BOX', identifier='story1', data_id='f5',
                                                context="'No Line Breaks' must be checked.", bounds=bounds('p1', 80))]},
        }, 6),
        'fonts': category({
            'Pangea Bold': {**EMPTY, 'errors': [item(validationClassifier='FONTS_INCLUDED', identifier='Pangea Bold',
                                                     page_id='', page_name='')]},
        }),
        'images': category({}),
        'general': category({}),
        'validation_classifiers': {},
        'text_box_data': {'story1': {'identifier': 'story1', 'content': 'AI-generated', 'page_id': 'p1', 'page_name': '1'}},
        'page_layouts': [{'page_id': p, 'name': str(i + 1), 'index': i + 1, 'spread_id': 's1', 'width': 600,
                          'height': 400, 'preview': None, 'frames': []} for i, p in enumerate(['p1', 'p2', 'p3'])],
        'checks': CHECKS,
        **overrides,
    }


def test_lists_blockers_with_why_where_and_how_without_internal_ids():
    text = build_customer_summary(make_result()).review_text

    assert ('We checked “Sample” and found 3 issues in the InDesign file that are likely causing the problems in '
            'Frontify, plus 1 that may change how it looks.') in text
    assert 'Likely causing the problems\n\n1. Kerning isn’t set to Metrics\nFrontify spaces letters' in text
    assert 'Where: paragraph styles “Headline” and “Body”, used on pages 1–3' in text
    assert '• In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.' in text
    assert 'Where: the text frame “AI-generated” (page 1, turn on No Line Breaks)' in text
    assert '\nLearn more\n' in text
    # Numbering continues across groups so the customer can refer to an item by number.
    assert 'May change how it looks\n\n4. Paragraph Composer used' in text
    assert 'upload it to Frontify' in text
    assert not re.search(r'\bf[1-5]\b|KERNING|story1', text)


def test_lists_the_same_frame_on_several_pages_once_and_drops_the_file_extension():
    frames = [item(validationClassifier='AUTO_SIZE_TEXT_BOX', identifier='story1', data_id=f'f-{p}', page_id=p,
                   bounds=bounds(p, 80)) for p in ('p1', 'p2', 'p3')]
    text = build_customer_summary(make_result(
        template_name='Sample.zip', par_styles=category({}), fonts=category({}),
        text_boxes=category({'story1': {**EMPTY, 'errors': frames}}),
    )).review_text

    assert 'We checked “Sample” and found one issue in the InDesign file that is likely causing' in text
    assert 'Where: the text frame “AI-generated” (pages 1–3)' in text
    assert 'Likely causing the problems' not in text  # a single group needs no heading


def test_names_frames_on_the_same_page_once_and_puts_checker_details_in_plain_words():
    text = build_customer_summary(make_result(
        par_styles=category({'NormalParagraphStyle': {**EMPTY, 'warnings': [
            item(validationClassifier='COMPOSER', identifier='NormalParagraphStyle', bounds=bounds('p1', 10))]}}),
        fonts=category({}),
        text_boxes=category({sid: {**EMPTY, 'warnings': [
            item(validationClassifier='OVERRIDE', identifier=sid, data_id=sid, bounds=bounds('p1', 10))]} for sid in ('s1', 's2')}),
        general=category({'document': {**EMPTY, 'warnings': [item(
            validationClassifier='DOCUMENT_BLEED', identifier='document', page_id='', page_name='',
            context='top: 8.503937007874017pt, bottom: 8.503937007874017pt, inside: 8.503937007874017pt, '
                    'outside: 8.503937007874017pt.')]}}),
        text_box_data={'s1': {'content': 'Title'}, 's2': {'content': 'Intro'}},
        checks=[],
    )).review_text

    assert 'Where: text frames “Intro”, “Title” (page 1)' in text
    assert 'Where: the paragraph style “[Basic Paragraph]”, used on page 1' in text
    assert 'Current bleed: 3 mm on all sides' in text
    assert not re.search(r'8\.50|NormalParagraphStyle', text)


def test_says_which_formatting_was_overridden_in_indesigns_words():
    override = lambda o: item(validationClassifier='OVERRIDE', identifier='story1', data_id='f5', bounds=bounds('p1', 80),
                              context_details={'overrides': o})
    text = build_customer_summary(make_result(
        par_styles=category({}), fonts=category({}),
        text_boxes=category({'story1': {**EMPTY, 'warnings': [override({'AppliedFont': 'Arial', 'MiterLimit': '4'}),
                                                              override({'FontStyle': 'Bold', 'PointSize': '12'})]}}),
    )).review_text

    assert 'Where: the text frame “AI-generated” (page 1, font and size changed)' in text
    assert '• To remove it, select the text and click Clear Overrides' in text


def test_covers_warning_only_templates_and_lists_infos_as_worth_a_check():
    text = build_customer_summary(make_result(
        par_styles=category({'Headline': {**EMPTY, 'warnings': [
            item(validationClassifier='COMPOSER', identifier='Headline', data_id='f1', bounds=bounds('p1', 10))]}}),
        text_boxes=category({'story1': {**EMPTY, 'infos': [
            item(validationClassifier='EMPTY_TEXT_FRAME', identifier='story1', data_id='f5', bounds=bounds('p1', 80))]}}),
        fonts=category({}),
    )).review_text

    assert ('We checked “Sample” and didn’t find anything that should stop it from working in Frontify, but one issue '
            'may make it look different') in text
    assert 'Worth a quick check (often fine as is)\n\n2. Empty text frame' in text
    assert 'Once that’s done, package the document again' in text


def test_nothing_found_is_a_single_intro():
    summary = build_customer_summary({'template_name': 'Clean.zip'})

    assert [s.key for s in summary.sections] == ['intro']
    assert summary.review_text == ('We checked “Clean” and didn’t find anything in the InDesign file that would cause '
                                   'problems in Frontify.')
    assert summary.counts == {'errors': 0, 'warnings': 0, 'infos': 0}


def test_html_for_intercom_escapes_text_and_links_help_articles():
    html = build_customer_summary(make_result(template_name='A <b> & “quotes”')).html

    assert '<p><strong>Likely causing the problems</strong></p>' in html
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


def test_check_guides_cover_every_check_that_ran_or_found_something():
    guides = check_guides_payload(make_result())

    assert set(guides['errors']) == {'KERNING', 'AUTO_SIZE_TEXT_BOX', 'FONTS_INCLUDED', 'TABLE'}
    assert set(guides['warnings']) == {'COMPOSER'}
    assert guides['errors']['KERNING'] == {
        'title': 'Kerning isn’t set to Metrics',
        'why': 'Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
        'fix': ['In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.'],
        'subject': 'paragraph-style',
    }
    assert check_guides_payload({}) == {}


def test_format_pages():
    assert format_pages(['1', '2', '3', '5', '7', '8']) == '1–3, 5, 7–8'
    assert format_pages(['A', 'B']) == 'A, B'
    assert format_pages([]) == ''
