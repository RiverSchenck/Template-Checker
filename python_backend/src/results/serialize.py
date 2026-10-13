"""The results JSON: the only place that knows its shape (the web app, customer summary and analytics read it).

results_v2 writes results v2 (plan §4.3; the contract is src/results/models.py):

    {schema_version: 2, template_name, issues: [{check, severity, subject, location, facts, text, detail}],
     subjects_checked, pages, text_boxes, checks}
"""
from typing import Dict, List, Optional

from src.results import catalogue
from src.results.catalogue import Entry
from src.results.issue import Issue
from src.results.layout import DocumentLayout
from src.results.results import Results



def results_v2(results: Results, layout: DocumentLayout, *, template_name: Optional[str],
               totals: Dict[str, int]) -> dict:
    """Results v2. totals: how many of each kind of subject the document has (pipeline.run.count_totals)."""
    return {
        'schema_version': 2,
        'template_name': template_name or 'No Name',
        'issues': [_issue(issue, layout) for issue in results],
        'subjects_checked': dict(totals),
        'pages': [{'id': page['page_id'], 'name': page['name'], 'index': page['index'],
                   'spread_id': page['spread_id'] or None, 'width': page['width'], 'height': page['height'],
                   'preview': page['preview'], 'frames': page['frames']} for page in _page_layouts(layout)],
        'text_boxes': _text_boxes(results, layout),
        'checks': [check_json(entry) for entry in catalogue.ENTRIES],
    }


def _issue(issue: Issue, layout: DocumentLayout) -> dict:
    entry = catalogue.BY_KEY[issue.check]
    page_id = layout.page_of(issue.data_id, issue.page_id) or None
    subject = issue.subject
    return {
        'check': entry.key,
        'severity': entry.severity,
        'subject': {'kind': subject.kind, 'id': subject.id, 'name': subject.name},
        'location': {'page_id': page_id, 'page_name': layout.pages.get(page_id),
                     'spread_id': layout.spread_of(page_id or '') or None, 'item_id': issue.data_id or None,
                     'bounds': layout.bounds(issue.data_id)},
        'facts': issue.context_details,
        'text': issue.text_content if entry.shows_text and issue.text_content else None,
        'detail': issue.context or None,
    }


def _text_boxes(results: Results, layout: DocumentLayout) -> Dict[str, dict]:
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
    return {'key': entry.key, 'severity': entry.severity, 'subject_kinds': list(entry.subject_kinds),
            'title': entry.title, 'why': entry.why,
            'fix': {kind: list(entry.fix_for(kind)) for kind in entry.subject_kinds},
            'help_article': entry.help_article, 'is_check': entry.is_check}


def _page_layouts(layout: DocumentLayout) -> List[dict]:
    """Pages in document order with size (points), preview image and frame outlines, for highlighting issues."""
    if not layout.geometry:
        return []
    frames = layout.geometry.get_page_frames()
    return [{**page, 'preview': layout.previews.get(page['page_id']), 'frames': frames.get(page['page_id'], [])}
            for page in layout.geometry.get_pages()]
