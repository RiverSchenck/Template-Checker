"""The issues a run found. Checks add to it; serialize.results_json turns it into the response."""
from typing import Iterator, List, Optional

from src.results.classifiers import Classifier, Severity
from src.results.issue import Issue


def _none_if_null(value: Optional[str]) -> Optional[str]:
    """Checks write "nothing" as None or 'null'; store one form, so the two never become separate groups."""
    return None if value in (None, 'null') else value


class Results:
    """Every issue reported, in the order it was reported."""

    def __init__(self):
        self._issues: List[Issue] = []

    def add(self, classifier: Classifier, context: Optional[str] = '', *, page_id: Optional[str] = '',
            identifier: Optional[str] = None, data_id: Optional[str] = None, text_content: Optional[list] = None,
            context_details: Optional[dict] = None) -> None:
        """Record an issue. Its severity and results section come from the classifier.

        An issue with text at the same place as an earlier one (same classifier, identifier, page and item) only
        adds its text to that one, so a style used in many runs of one frame is reported once. Classifiers marked
        one_per_range (overrides) are never merged.
        """
        issue = Issue(classifier, context or '', page_id or '', _none_if_null(identifier), _none_if_null(data_id),
                      list(text_content or []), context_details)
        if issue.text_content and not classifier.one_per_range:
            earlier = next((i for i in self._issues if (i.classifier, i.identifier, i.page_id, i.data_id) ==
                            (classifier, issue.identifier, issue.page_id, issue.data_id)), None)
            if earlier:
                earlier.text_content = list(dict.fromkeys(earlier.text_content + issue.text_content))
                return
        self._issues.append(issue)

    def issues(self, severity: Optional[Severity] = None) -> List[Issue]:
        """Every issue (of one severity, if given), in the order reported."""
        return [i for i in self._issues if severity in (None, i.classifier.severity)]

    def names(self, severity: Severity) -> List[str]:
        """The classifier name of every issue of this severity, one per issue."""
        return [i.classifier.name for i in self.issues(severity)]

    def __iter__(self) -> Iterator[Issue]:
        return iter(self._issues)
