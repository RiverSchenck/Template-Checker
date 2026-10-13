"""Shared plumbing for checks: record an issue, and where it is (page, identifier, frame)."""
from typing import Optional, Tuple

from src.model.document import Document
from src.model.styles import Resolved
from src.results.classifiers import Classifier
from src.results.results import Results


def report(results: Results, classifier: Classifier, context: Optional[str] = None, *, page_id: str = '',
           identifier='null', data_id='null', text_content: Optional[list] = None,
           context_details: Optional[dict] = None) -> None:
    """Record an issue. Its severity comes from the classifier (ValidationError.X is an error, and so on)."""
    results.add(classifier, context, page_id=page_id, identifier=identifier, data_id=data_id,
                text_content=text_content, context_details=context_details)


# --- where an issue is -----------------------------------------------------------------------------------------

def at_story(doc: Document, story, identifier) -> dict:
    """An issue in a story's text: the story's page and its text frame."""
    return dict(page_id=doc.story_page.get(story.id), identifier=identifier, data_id=doc.story_frame.get(story.id, ''))


def at_frame(doc: Document, frame) -> dict:
    """An issue with a text frame: identified by its story, located by the frame. A frame whose story is missing
    from the package still gets its own story reference and the page it sits on."""
    story = doc.story_of_frame(frame)
    if story is not None:
        story_id, page_id = story.id, doc.story_page.get(story.id)
    else:
        story_id, page_id = frame.story_id, doc.page_of_item(frame.id)
    return dict(page_id=page_id, identifier=story_id, data_id=frame.id)


def first_page_id(spread) -> str:
    """Self of the spread's first page (the fallback location for items without one of their own)."""
    return spread.pages[0].id if spread.pages else ''


def at_item(doc: Document, spread, item) -> dict:
    """An issue with a page item other than a text frame: identified as 'Kind:id'."""
    return dict(page_id=doc.page_of_item(item.id) if item.id else first_page_id(spread),
                identifier=f"{item.kind}:{item.id}" if item.id else item.kind, data_id=item.id or 'null')


def at_link(doc: Document, spread, link) -> dict:
    """An issue with a placed image: identified by file name, located by its frame."""
    frame_id = link.frame_id
    page_id = doc.page_of_item(frame_id) if frame_id else first_page_id(spread)
    return dict(page_id=page_id, identifier=link.name, data_id=frame_id)


# --- what to say about it --------------------------------------------------------------------------------------

def inherited(resolved: Resolved, style_id: Optional[str]) -> Tuple[str, Optional[dict]]:
    """Context for a style property: ('Inherited from: <style>', {'inheritedFrom': <style>}), or ('', None)
    when the style sets it itself."""
    source = resolved.inherited_from(style_id)
    if not source:
        return '', None
    return f'Inherited from: {source}', {"inheritedFrom": source}


def text_list(content: str) -> Optional[list]:
    """text_content for an issue: the text it's about, so repeated issues merge their snippets."""
    return [content] if content else None
