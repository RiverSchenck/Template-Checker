"""The results JSON: the only place that knows its shape (the web app, customer summary and analytics read it).

results_v2 writes results v2 (plan §4.3; the contract is src/results/models.py):

    {schema_version: 2, template_name, issues: [{check, severity, subject, location, facts, text, note, detail}],
     subjects_checked, pages, text_boxes, checks}
"""
from typing import Dict, List, Optional

from src.model.document import Document
from src.results import catalogue, notes
from src.results.catalogue import Entry
from src.results.issue import Issue
from src.results.results import Results


def results_v2(results: Results, document: Optional[Document], *, template_name: Optional[str],
               totals: Dict[str, int], previews: Optional[Dict[str, str]] = None) -> dict:
    """Results v2. document: what was checked (None when the upload was rejected before it was read); totals: how
    many of each kind of subject it has (pipeline.run.count_totals); previews: page Self -> base64 JPEG."""
    where = _Where(document)
    return {
        'schema_version': 2,
        'template_name': template_name or 'No Name',
        'issues': [_issue(issue, where) for issue in results],
        'subjects_checked': dict(totals),
        'pages': _pages(document, previews or {}),
        'text_boxes': _text_boxes(results, document, where),
        'checks': [check_json(entry) for entry in catalogue.ENTRIES],
    }


class _Where:
    """Where things are in the document: pages by Self, their spreads, and items' positions."""

    def __init__(self, document: Optional[Document]):
        self.geometry = document.geometry if document else None
        self.page_names: Dict[str, str] = {}
        self.spreads: Dict[str, str] = {}
        for spread in document.spreads if document else ():
            for page in spread.pages:
                self.page_names[page.id] = page.name
                if spread.id:
                    self.spreads[page.id] = spread.id

    def bounds(self, item_id: Optional[str]) -> Optional[dict]:
        return self.geometry.get_bounds(item_id) if self.geometry and item_id else None

    def page_of(self, item_id: Optional[str], fallback_page_id: Optional[str]) -> Optional[str]:
        """The page an item is on: from its position when known (e.g. the right page of a spread), else the
        fallback."""
        return (self.bounds(item_id) or {}).get('page_id') or fallback_page_id or None


def _issue(issue: Issue, where: _Where) -> dict:
    entry = catalogue.BY_KEY[issue.check]
    page_id = where.page_of(issue.data_id, issue.page_id)
    subject = issue.subject
    return {
        'check': entry.key,
        'severity': entry.severity,
        'subject': {'kind': subject.kind, 'id': subject.id, 'name': subject.name},
        'location': {'page_id': page_id, 'page_name': where.page_names.get(page_id),
                     'spread_id': where.spreads.get(page_id), 'item_id': issue.data_id,
                     'bounds': where.bounds(issue.data_id)},
        'facts': issue.context_details,
        'text': issue.text_content if entry.shows_text and issue.text_content else None,
        'note': notes.note(entry.key, issue.context_details),
        'detail': issue.context or None,
    }


def _text_boxes(results: Results, document: Optional[Document], where: _Where) -> Dict[str, dict]:
    """The text of every text frame an issue is about, by subject id: a frame's Self (any frame of a threaded story
    shows its whole text), or a story's Self for text in no frame."""
    ids = list(dict.fromkeys(i.subject.id for i in results if i.subject.kind == 'text_frame' and i.subject.id))
    if not ids or document is None:
        return {}
    frames = {frame.id: frame for _, frame in document.text_frames() if frame.id}
    data: Dict[str, dict] = {}
    for subject_id in ids:
        story, frame_id, fallback_page = document.stories_by_id.get(subject_id), None, None
        if story is not None:
            frame_id, fallback_page = document.story_frame.get(story.id), document.story_page.get(story.id)
        elif subject_id in frames:
            story, frame_id = document.story_of_frame(frames[subject_id]), subject_id
            # The story's own frame is placed with the story; any other frame of it, by itself.
            first = document.story_frame.get(story.id) if story is not None else None
            fallback_page = document.story_page.get(story.id) if frame_id == first else document.page_of_item(frame_id)
        if story is not None:
            data[subject_id] = {'content': document.story_text(story),
                                'page_id': where.page_of(frame_id if frame_id != 'null' else None, fallback_page)}
    return data


def check_json(entry: Entry) -> dict:
    """A catalogue entry as results v2 lists it."""
    return {'key': entry.key, 'severity': entry.severity, 'subject_kinds': list(entry.subject_kinds),
            'title': entry.title, 'why': entry.why,
            'fix': {kind: list(entry.fix_for(kind)) for kind in entry.subject_kinds},
            'help_article': entry.help_article, 'is_check': entry.is_check}


def _pages(document: Optional[Document], previews: Dict[str, str]) -> List[dict]:
    """Pages in document order with size (points), preview image and frame outlines, for highlighting issues."""
    geometry = document.geometry if document else None
    if not geometry:
        return []
    frames = geometry.get_page_frames()
    return [{'id': page['page_id'], 'name': page['name'], 'index': page['index'],
             'spread_id': page['spread_id'] or None, 'width': page['width'], 'height': page['height'], 'preview': previews.get(page['page_id']),
             'frames': frames.get(page['page_id'], [])}
            for page in geometry.get_pages()]
