"""The results JSON: the only place that knows its shape (the frontend, customer summary and analytics read it).

    {template_name, output_folder,
     par_styles | char_styles | text_boxes | fonts | images | general:
         {details: {identifier: {errors: [...], warnings: [...], infos: [...]}}, total_count},
     validation_classifiers, text_box_data, spread_to_pages, pages, page_layouts, checks}

"Nothing" is the string 'null' in identifiers and data ids, as the frontend expects.
"""
from typing import Dict, List, Optional

from src.results.classifiers import Category, Severity, all_classifiers
from src.results.issue import Issue
from src.results.layout import DocumentLayout
from src.results.results import Results

NULL = 'null'


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
        item['context_details'] = issue.context_details
    if issue.classifier.shows_text and issue.text_content:
        item['text_content'] = issue.text_content
    return item


def _classifiers_used(results: Results) -> Dict[str, dict]:
    """Label, message and help link of each classifier that has an issue."""
    used: Dict[str, dict] = {}
    for issue in results:
        c = issue.classifier
        used.setdefault(c.name, {'label': c.label, 'message': c.message or '', 'help_article': c.help_article})
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
        {'key': c.name, 'severity': c.severity.value, 'label': c.label, 'message': c.message or '',
         'help_article': c.help_article, 'category': c.category.value}
        for c in all_classifiers() if c.is_check
    ]
