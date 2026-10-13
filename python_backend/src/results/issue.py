"""One reported issue."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.model.subject import DOCUMENT, Subject
from src.results.classifiers import Classifier


@dataclass
class Issue:
    classifier: Classifier
    context: str = ''
    """What the issue is about, in words (e.g. "Kerning is Optical; Inherited from: Body")."""
    page_id: str = ''
    """Self of the page it was reported on; the item's own page wins when its position is known."""
    identifier: Optional[str] = None
    """What it's merged on (with the classifier, page and item): a style, story, font or file name. None for nothing.
    v1's grouping; the merge moves to the subject when checks report v2 checks (plan PR 6.1)."""
    data_id: Optional[str] = None
    """Self of the page item it points at, for highlighting. None for none."""
    subject: Subject = DOCUMENT
    """What it's about: results v2's subject."""
    text_content: List[str] = field(default_factory=list)
    """The text it's about, when the classifier shows text."""
    context_details: Optional[Dict[str, Any]] = None
    """Structured data for the frontend (e.g. text, overrides, inherited_from)."""
