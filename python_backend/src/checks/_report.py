"""Shared plumbing for checks: record an issue, and where it is (page, identifier, frame)."""
from typing import Optional, Tuple

from src.model import subject as subjects
from src.model.document import Document, short_style_id
from src.model.styles import Resolved
from src.model.subject import DOCUMENT, Subject
from src.results.classifiers import Classifier
from src.results.results import Results


def report(results: Results, classifier: Classifier, context: Optional[str] = None, *, page_id: str = '',
           identifier='null', data_id='null', text_content: Optional[list] = None,
           context_details: Optional[dict] = None, subject: Subject = DOCUMENT) -> None:
    """Record an issue. Its severity comes from the classifier (ValidationError.X is an error, and so on)."""
    results.add(classifier, context, page_id=page_id, identifier=identifier, data_id=data_id,
                text_content=text_content, context_details=context_details, subject=subject)


# --- where an issue is -----------------------------------------------------------------------------------------

def at_story(doc: Document, story) -> dict:
    """An issue with a story's text frame: the story's page and its text frame."""
    frame_id = doc.story_frame.get(story.id, '')
    return dict(page_id=doc.story_page.get(story.id), identifier=story.id, data_id=frame_id,
                subject=subjects.text_frame(story.id, frame_id))


def at_style(doc: Document, story, kind: str, style_id: Optional[str]) -> dict:
    """An issue with a paragraph or character style (kind), found in a story's text: located like at_story."""
    return {**at_story(doc, story), 'identifier': short_style_id(style_id),
            'subject': subjects.style(doc.styles, kind, style_id)}


def at_frame(doc: Document, frame) -> dict:
    """An issue with a text frame: identified by its story, located by the frame. A frame whose story is missing
    from the package still gets its own story reference and the page it sits on."""
    story = doc.story_of_frame(frame)
    if story is not None:
        story_id, page_id = story.id, doc.story_page.get(story.id)
    else:
        story_id, page_id = frame.story_id, doc.page_of_item(frame.id)
    return dict(page_id=page_id, identifier=story_id, data_id=frame.id, subject=subjects.text_frame(story_id, frame.id))


def first_page_id(spread) -> str:
    """Self of the spread's first page (the fallback location for items without one of their own); '' for an
    item placed in a story that isn't on a spread (spread None)."""
    return spread.pages[0].id if spread and spread.pages else ''


def at_item(doc: Document, spread, item) -> dict:
    """An issue with a page item other than a text frame: identified as 'Kind:id'."""
    return dict(page_id=doc.page_of_item(item.id) if item.id else first_page_id(spread),
                identifier=f"{item.kind}:{item.id}" if item.id else item.kind, data_id=item.id or 'null',
                subject=subjects.page_item(item))


def at_link(doc: Document, spread, link) -> dict:
    """An issue with a placed image: identified by file name, located by its frame."""
    frame_id = link.frame_id
    page_id = doc.page_of_item(frame_id) if frame_id else first_page_id(spread)
    return dict(page_id=page_id, identifier=link.name, data_id=frame_id, subject=subjects.image(link.name))


# --- what to say about it --------------------------------------------------------------------------------------

def inherited(resolved: Resolved, style_id: Optional[str]) -> Tuple[str, Optional[dict]]:
    """Context for a style property: ('Inherited from: <style>', {'inherited_from': <style>}), or ('', None)
    when the style sets it itself."""
    source = resolved.inherited_from(style_id)
    if not source:
        return '', None
    return f'Inherited from: {source}', {'inherited_from': source}


def text_list(content: str) -> Optional[list]:
    """text_content for an issue: the text it's about, so repeated issues merge their snippets."""
    return [content] if content else None
