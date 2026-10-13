"""The results JSON: the only place that knows its shape (the frontend, customer summary and analytics read it).

results_v2 writes results v2 (plan §4.3; the contract is src/results/models.py):

    {schema_version: 2, template_name, issues: [{check, severity, subject, location, facts, text, detail}],
     subjects_checked, pages, text_boxes, checks}

results_json writes v1, which the web API still sends until the web app reads v2 (plan PR 5.3):

    {template_name, output_folder,
     par_styles | char_styles | text_boxes | fonts | images | general:
         {details: {identifier: {errors: [...], warnings: [...], infos: [...]}}, total_count},
     validation_classifiers, text_box_data, spread_to_pages, pages, page_layouts, checks}

In v1, "nothing" is the string 'null' in identifiers and data ids, as the frontend expects; v2 writes null.
"""
from typing import Dict, List, Optional

from src.results import catalogue
from src.results.catalogue import Entry
from src.results.classifiers import Category, Severity, all_classifiers
from src.results.issue import Issue
from src.results.layout import DocumentLayout
from src.results.results import Results

NULL = 'null'

SEVERITY = {Severity.ERROR: 'error', Severity.WARNING: 'warning', Severity.INFO: 'info'}
# What the document has of each kind of subject, from the totals per v1 section.
SUBJECT_TOTALS = {Category.PAR_STYLE: 'paragraph_style', Category.CHAR_STYLE: 'character_style',
                  Category.TEXT_BOX: 'text_frame', Category.FONTS: 'font', Category.IMAGES: 'image'}


def results_v2(results: Results, layout: DocumentLayout, *, template_name: Optional[str],
               totals: Dict[Category, int]) -> dict:
    """Results v2. totals: how many styles, text boxes, fonts and images the document has, per v1 section."""
    return {
        'schema_version': 2,
        'template_name': template_name or 'No Name',
        'issues': [_issue_v2(issue, layout) for issue in results],
        'subjects_checked': {SUBJECT_TOTALS[c]: n for c, n in totals.items() if c in SUBJECT_TOTALS},
        'pages': [{'id': page['page_id'], 'name': page['name'], 'index': page['index'],
                   'spread_id': page['spread_id'] or None, 'width': page['width'], 'height': page['height'],
                   'preview': page['preview'], 'frames': page['frames']} for page in _page_layouts(layout)],
        'text_boxes': _text_boxes_v2(results, layout),
        'checks': [check_json(entry) for entry in catalogue.ENTRIES],
    }


def _issue_v2(issue: Issue, layout: DocumentLayout) -> dict:
    entry, _ = catalogue.for_v1(issue.classifier.name)
    page_id = layout.page_of(issue.data_id, issue.page_id) or None
    subject = issue.subject
    return {
        'check': entry.key,
        'severity': SEVERITY[issue.classifier.severity],
        'subject': {'kind': subject.kind, 'id': subject.id, 'name': subject.name},
        'location': {'page_id': page_id, 'page_name': layout.pages.get(page_id),
                     'spread_id': layout.spread_of(page_id or '') or None, 'item_id': issue.data_id or None,
                     'bounds': layout.bounds(issue.data_id)},
        'facts': issue.context_details,
        'text': issue.text_content if issue.classifier.shows_text and issue.text_content else None,
        'detail': issue.context or None,
    }


def _text_boxes_v2(results: Results, layout: DocumentLayout) -> Dict[str, dict]:
    """The text of every text frame an issue is about, by subject id."""
    data: Dict[str, dict] = {}
    for issue in results:
        subject = issue.subject
        box = layout.text_boxes.get(subject.id) if subject.kind == 'text_frame' and subject.id else None
        if box and subject.id not in data:
            data[subject.id] = {'content': box.content, 'page_id': layout.page_of(box.frame_id, box.page_id) or None}
    return data


def check_json(entry: Entry) -> dict:
    """A catalogue entry as results v2 lists it."""
    return {'key': entry.key, 'severity': SEVERITY[entry.severity], 'subject_kinds': list(entry.subject_kinds),
            'title': entry.title, 'why': entry.why,
            'fix': {kind: list(entry.fix_for(kind)) for kind in entry.subject_kinds},
            'help_article': entry.help_article, 'is_check': entry.is_check}


def _or_null(value: Optional[str]) -> str:
    return NULL if value is None else value


def results_json(results: Results, layout: DocumentLayout, *, template_name: Optional[str],
                 output_folder: Optional[str], totals: Dict[Category, int]) -> dict:
    """totals: how many styles, text boxes, fonts and images the document has, per section."""
    return {
        'template_name': template_name or 'No Name',
        'output_folder': output_folder,
        **{category.value: {'details': _details(results, category, layout), 'total_count': totals.get(category, 0)}
           for category in Category},
        'validation_classifiers': _classifiers_used(results),
        'text_box_data': _text_box_data(results, layout),
        'spread_to_pages': layout.spread_to_pages,
        'pages': layout.pages,
        'page_layouts': _page_layouts(layout),
        'checks': _checks(),
    }


def _details(results: Results, category: Category, layout: DocumentLayout) -> dict:
    """The section's issues grouped by identifier (in the order first reported), then by severity."""
    details: Dict[str, Dict[str, List[dict]]] = {}
    for issue in results:
        if issue.classifier.category == category:
            group = details.setdefault(_or_null(issue.identifier), {s.value: [] for s in Severity})
            group[issue.classifier.severity.value].append(_issue_json(issue, layout))
    return details


def _issue_json(issue: Issue, layout: DocumentLayout) -> dict:
    page_id = layout.page_of(issue.data_id, issue.page_id)
    item = {
        'validationClassifier': issue.classifier.name,
        'context': issue.context,
        'identifier': _or_null(issue.identifier),
        'page_id': page_id,
        'page_name': layout.page_name(page_id),
        'spread_id': layout.spread_of(page_id),
        'data_id': _or_null(issue.data_id),
    }
    bounds = layout.bounds(issue.data_id)
    if bounds:
        item['bounds'] = bounds
    if issue.context_details is not None:
        item['context_details'] = _v1_facts(issue.context_details)
    if issue.classifier.shows_text and issue.text_content:
        item['text_content'] = issue.text_content
    return item


def _v1_facts(facts: dict) -> dict:
    """v1 spells inherited_from as inheritedFrom."""
    return {('inheritedFrom' if key == 'inherited_from' else key): value for key, value in facts.items()}


def _classifiers_used(results: Results) -> Dict[str, dict]:
    """Label (the catalogue title) and help link of each classifier that has an issue. The message is no longer
    used (plan D2: the catalogue's why replaces it) and stays empty until results v2 drops the field."""
    used: Dict[str, dict] = {}
    for issue in results:
        entry, _ = catalogue.for_v1(issue.classifier.name)
        used.setdefault(issue.classifier.name, {'label': catalogue.v1_title(issue.classifier.name), 'message': '',
                                                'help_article': entry.help_article})
    return used


def _text_box_data(results: Results, layout: DocumentLayout) -> Dict[str, dict]:
    """The text of every text box with a text box issue, so the frontend can show it."""
    data: Dict[str, dict] = {}
    for issue in results:
        box = layout.text_boxes.get(issue.identifier) if issue.classifier.category == Category.TEXT_BOX else None
        if box and issue.identifier not in data:
            page_id = layout.page_of(box.frame_id, box.page_id)
            data[issue.identifier] = {'identifier': issue.identifier, 'content': box.content, 'page_id': page_id,
                                      'page_name': layout.page_name(page_id)}
    return data


def _page_layouts(layout: DocumentLayout) -> List[dict]:
    """Pages in document order with size (points), preview image and frame outlines, for highlighting issues."""
    if not layout.geometry:
        return []
    frames = layout.geometry.get_page_frames()
    return [{**page, 'preview': layout.previews.get(page['page_id']), 'frames': frames.get(page['page_id'], [])}
            for page in layout.geometry.get_pages()]


def _checks() -> List[dict]:
    """Every template check, so the frontend can list what passed."""
    return [
        {'key': c.name, 'severity': c.severity.value, 'label': catalogue.v1_title(c.name), 'message': '',
         'help_article': entry.help_article, 'category': c.category.value}
        for c, (entry, _) in ((c, catalogue.for_v1(c.name)) for c in all_classifiers()) if entry.is_check
    ]
