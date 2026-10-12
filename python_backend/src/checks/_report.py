"""Shared plumbing for checks: record an issue, and where it is (page, identifier, frame).

Severity comes from the classifier: a ValidationError is reported as an error, a ValidationWarning as a
warning, a ValidationInfo as an info.
"""
from typing import Optional, Tuple

from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationInfo, ValidationWarning


def report(results: ValidationResult, classifier, context: Optional[str] = None, *, page_id: str = '',
           identifier='null', data_id='null', text_content: Optional[list] = None,
           context_details: Optional[dict] = None) -> None:
    kwargs = dict(context=context, page_id=page_id, identifier=identifier, data_id=data_id,
                  text_content=text_content, context_details=context_details)
    if isinstance(classifier, ValidationError):
        results.add_error(error_type=classifier, **kwargs)
    elif isinstance(classifier, ValidationWarning):
        results.add_warning(warning_type=classifier, **kwargs)
    elif isinstance(classifier, ValidationInfo):
        results.add_info(info_type=classifier, **kwargs)
    else:
        raise TypeError(f'Not a validation classifier: {classifier!r}')


# --- where an issue is -----------------------------------------------------------------------------------------

def at_story(story, identifier) -> dict:
    """An issue in a story's text: the story's page and its text frame."""
    return dict(page_id=story.get_page(), identifier=identifier, data_id=story.get_parent_text_frame_id())


def at_frame(doc, text_frame) -> dict:
    """An issue with a text frame: identified by its story, located by the frame."""
    story_id, page_id = doc.frame_story_and_page(text_frame)
    return dict(page_id=page_id, identifier=story_id, data_id=text_frame.get_frame_id())


def first_page_id(spread) -> str:
    """Self of the spread's first page (the fallback location for items without one of their own)."""
    pages = spread.get_pages()
    return pages[0].get("self", '') if pages else ''


def at_link(doc, spread, link) -> dict:
    """An issue with a placed image: identified by file name, located by its frame."""
    rectangle_id = link.get_rectangle_link_id()
    page_id = doc.find_page_id_from_data_id(rectangle_id) if rectangle_id else first_page_id(spread)
    return dict(page_id=page_id, identifier=link.get_image_name(), data_id=rectangle_id)


# --- what to say about it --------------------------------------------------------------------------------------

def inherited(prop) -> Tuple[str, Optional[dict]]:
    """Context for a style property: ('Inherited from: <style>', {'inheritedFrom': <style>}), or ('', None)
    when the style sets it itself."""
    source = prop.get_inherited_from_value()
    if not source:
        return '', None
    return f'Inherited from: {source}', {"inheritedFrom": source}


def text_list(content: str) -> Optional[list]:
    """text_content for an issue: the text it's about, so repeated issues merge their snippets."""
    return [content] if content else None
