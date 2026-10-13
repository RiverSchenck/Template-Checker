"""One reported issue."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.model.subject import DOCUMENT, Subject


@dataclass
class Issue:
    check: str
    """Its check in the catalogue (src/results/catalogue.py), e.g. KERNING."""
    context: str = ''
    """What the issue is about, in words (e.g. "Kerning is Optical; Inherited from: Body")."""
    page_id: str = ''
    """Self of the page it was reported on; the item's own page wins when its position is known."""
    data_id: Optional[str] = None
    """Self of the page item it points at, for highlighting. None for none."""
    subject: Subject = DOCUMENT
    """What it's about."""
    text_content: List[str] = field(default_factory=list)
    """The text it's about, when the check shows text."""
    context_details: Optional[Dict[str, Any]] = None
    """Its facts (the check's facts model), e.g. {'size_mb': 12.5}."""
