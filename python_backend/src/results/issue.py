"""One reported issue."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.results.classifiers import Classifier


@dataclass
class Issue:
    classifier: Classifier
    context: str = ''
    """What the issue is about, in words (e.g. "Kerning is Optical; Inherited from: Body")."""
    page_id: str = ''
    """Self of the page it was reported on; the item's own page wins when its position is known."""
    identifier: Optional[str] = None
    """What it's grouped under in the results: a style, story, font or file name. None for nothing."""
    data_id: Optional[str] = None
    """Self of the page item it points at, for highlighting. None for none."""
    text_content: List[str] = field(default_factory=list)
    """The text it's about, when the classifier shows text."""
    context_details: Optional[Dict[str, Any]] = None
    """Structured data for the frontend (e.g. text, overrides, inheritedFrom)."""
