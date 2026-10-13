"""The issues a run found. Checks add to it; serialize.results_v2 turns it into the results JSON."""
from typing import Iterator, List, Optional

from src.model.subject import DOCUMENT, Subject
from src.results.catalogue import BY_KEY
from src.results.issue import Issue


def _none_if_null(value: Optional[str]) -> Optional[str]:
    """Checks write "no item" as None, '' or 'null'; store one form."""
    return None if value in (None, '', 'null') else value


class Results:
    """Every issue reported, in the order it was reported."""

    def __init__(self):
        self._issues: List[Issue] = []

    def add(self, check: str, context: Optional[str] = '', *, page_id: Optional[str] = '',
            data_id: Optional[str] = None, text_content: Optional[list] = None, context_details: Optional[dict] = None,
            subject: Subject = DOCUMENT) -> None:
        """Record an issue of a check (a catalogue key, which gives its severity).

        An issue with text about the same thing at the same place as an earlier one (same check, subject, page and
        item) only adds its text to that one, so a style used in many runs of one frame is reported once. Checks
        marked one_per_range (overrides) are never merged.
        """
        entry = BY_KEY[check]
        issue = Issue(check, context or '', page_id or '', _none_if_null(data_id), subject, list(text_content or []),
                      context_details)
        if issue.text_content and not entry.one_per_range:
            earlier = next((i for i in self._issues if (i.check, i.subject, i.page_id, i.data_id) ==
                            (check, subject, issue.page_id, issue.data_id)), None)
            if earlier:
                earlier.text_content = list(dict.fromkeys(earlier.text_content + issue.text_content))
                return
        self._issues.append(issue)

    def __iter__(self) -> Iterator[Issue]:
        return iter(self._issues)
